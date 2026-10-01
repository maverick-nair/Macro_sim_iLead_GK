/** Deep copy of plain JSON data (templates, drafts, patch values). Environment neutral. */
export function cloneJson<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneJson) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      if (v !== undefined) out[k] = cloneJson(v);
    return out as T;
  }
  return value;
}
