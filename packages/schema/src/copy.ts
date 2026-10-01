/**
 * Copy rules (CLAUDE.md "Copy rules"). They apply to all UI text, generated copy and seed copy; `pnpm lint:copy`
 * runs them over the repository and generators run them over AI output before it is saved.
 */
export type CopyRule = "em_dash" | "en_dash" | "spaced_hyphen" | "skills_word" | "product_name";

export interface CopyIssue {
  rule: CopyRule;
  match: string;
  index: number;
  message: string;
}

export interface CopyCheckOptions {
  /** Check banned words ("competency" and its forms). Off for docs, which quote the rule itself. */
  words?: boolean;
  /** Check product name spellings. */
  names?: boolean;
}

/** Correct spellings per name family; anything else in the family is flagged. */
const NAME_FAMILIES: { pattern: RegExp; allowed: readonly string[]; expected: string }[] = [
  { pattern: /\bgenie[\s-]*kreator\b/gi, allowed: ["GenieKreator"], expected: "GenieKreator" },
  { pattern: /\bi-?lead\b/gi, allowed: ["iLead"], expected: "iLead" },
  // "AI RolePlays" stays on the existing E1 card (decisions C-09).
  {
    pattern: /\bAI[\s-]*role[\s-]*plays?\b/gi,
    allowed: ["AI RolePlay", "AI RolePlays"],
    expected: "AI RolePlay",
  },
  { pattern: /\bdilo\b/gi, allowed: ["DILO"], expected: "DILO" },
];

/** A hyphen with spaces on both sides, except a minus sign between numbers ("57 - 54"). */
const SPACED_HYPHEN = /(?<![\d)%])\s-{1,2}\s(?![\d(])/g;

export function copyIssues(text: string, opts: CopyCheckOptions = {}): CopyIssue[] {
  const out: CopyIssue[] = [];
  const scan = (re: RegExp, rule: CopyRule, message: string, keep: (m: string) => boolean = () => true) => {
    for (const m of text.matchAll(re))
      if (keep(m[0])) out.push({ rule, match: m[0], index: m.index, message });
  };
  scan(/\u2014/g, "em_dash", "Em dash: use a comma, colon, full stop or parentheses");
  scan(/\u2013/g, "en_dash", 'En dash: use a comma, colon, full stop, "to" or parentheses');
  scan(
    SPACED_HYPHEN,
    "spaced_hyphen",
    "Hyphen used as punctuation: use a comma, colon, full stop or parentheses",
  );
  if (opts.words) scan(/competenc(?:y|ies|e|es)?/gi, "skills_word", 'Say "skills", never "competency"');
  if (opts.names)
    for (const f of NAME_FAMILIES)
      scan(f.pattern, "product_name", `Write "${f.expected}"`, (m) => !f.allowed.includes(m));
  return out.sort((a, b) => a.index - b.index);
}

/** Every string inside a JSON like value, with its JSON Pointer. */
export function collectStrings(value: unknown, path = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => collectStrings(v, `${path}/${i}`));
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      collectStrings(v, `${path}/${k.replace(/~/g, "~0").replace(/\//g, "~1")}`),
    );
  return [];
}
