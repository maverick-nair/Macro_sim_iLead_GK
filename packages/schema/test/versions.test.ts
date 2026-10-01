import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalJson, contentHash } from "../src/versions";

describe("canonical JSON and content hash", () => {
  it("ignores key order and undefined values", () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }], u: undefined })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
    expect(contentHash({ x: 1, y: 2 })).toBe(contentHash({ y: 2, x: 1 }));
  });

  it("produces 14 hex characters and changes with content", () => {
    expect(contentHash({ x: 1 })).toMatch(/^[0-9a-f]{14}$/);
    expect(contentHash({ x: 1 })).not.toBe(contentHash({ x: 2 }));
  });

  it("is stable for any JSON value", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        expect(contentHash(v)).toBe(contentHash(JSON.parse(JSON.stringify(v)) as unknown));
      }),
    );
  });
});
