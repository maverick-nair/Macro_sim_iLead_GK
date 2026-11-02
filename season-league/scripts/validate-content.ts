/** npm run validate-content: validates /content and prints the report. Exits 1 on any failure. */
import { validateContent } from "../shared/content-schema.ts";
import { readContentFiles } from "./content-files.ts";

const { raw, characters } = readContentFiles();
const report = validateContent(raw, characters);
console.log(report.lines.join("\n"));
console.log(report.ok ? "\nContent is valid." : "\nContent has errors. Fix them before publishing.");
process.exit(report.ok ? 0 : 1);
