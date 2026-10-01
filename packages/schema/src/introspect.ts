import type { z } from "zod";
import { parsePointer } from "./pointer";

interface Def {
  type: string;
  shape?: Record<string, z.ZodType>;
  element?: z.ZodType;
  innerType?: z.ZodType;
  options?: z.ZodType[];
  valueType?: z.ZodType;
  items?: z.ZodType[];
  in?: z.ZodType;
  getter?: () => z.ZodType;
}

const defOf = (s: z.ZodType): Def => (s as unknown as { _zod: { def: Def } })._zod.def;

/** Unwraps optional, nullable, default and pipe wrappers. */
function unwrap(s: z.ZodType): z.ZodType {
  let cur = s;
  for (;;) {
    const d = defOf(cur);
    if (
      (d.type === "optional" ||
        d.type === "nullable" ||
        d.type === "default" ||
        d.type === "prefault" ||
        d.type === "readonly") &&
      d.innerType
    )
      cur = d.innerType;
    else if (d.type === "pipe" && d.in) cur = d.in;
    else if (d.type === "lazy" && d.getter) cur = d.getter();
    else return cur;
  }
}

function step(s: z.ZodType, seg: string): z.ZodType[] {
  const d = defOf(unwrap(s));
  switch (d.type) {
    case "object": {
      const child = d.shape?.[seg];
      return child ? [child] : [];
    }
    case "array":
      return d.element && (seg === "*" || /^\d+$/.test(seg)) ? [d.element] : [];
    case "tuple":
      if (seg === "*") return d.items ?? [];
      return d.items?.[Number(seg)] ? [d.items[Number(seg)] as z.ZodType] : [];
    case "record":
      return d.valueType ? [d.valueType] : [];
    case "union":
      return (d.options ?? []).flatMap((o) => step(o, seg));
    default:
      return [];
  }
}

/**
 * True when a JSON Pointer pattern names a location the schema allows. "*" matches any array index or record key.
 * In unions, a path is valid when any option allows it.
 */
export function schemaHasPath(schema: z.ZodType, pattern: string): boolean {
  let frontier: z.ZodType[] = [schema];
  for (const seg of parsePointer(pattern)) {
    frontier = frontier.flatMap((s) => step(s, seg));
    if (frontier.length === 0) return false;
  }
  return true;
}
