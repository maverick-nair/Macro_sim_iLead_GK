import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderSchemas } from './schemas';

describe('docs/schemas (the handoff JSON Schemas)', () => {
  it('match the Zod schemas the app parses with; run `npm run schemas` after changing a contract', () => {
    const dir = path.resolve(import.meta.dirname, '../docs/schemas');
    for (const [file, text] of Object.entries(renderSchemas())) {
      expect(fs.readFileSync(path.join(dir, file), 'utf8'), file).toBe(text);
    }
  });
});
