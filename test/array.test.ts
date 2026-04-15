import { describe, it, expect } from "vitest";
import { Typeset } from "../src/core.js";
import { ArrayType, ArrayPatchBuilder, ARRAY_OP } from "../src/types/array.js";

const mkType = () => new ArrayType(new Typeset("test"));

describe("ArrayType — applyPatch", () => {
  const t = mkType();
  it("INSERT at start", () => {
    const { state } = t.applyPatch(
      { __type: "array:patch", ops: [{ kind: ARRAY_OP.INSERT, index: 0, items: [1, 2] }] },
      [3, 4]
    );
    expect(state).toEqual([1, 2, 3, 4]);
  });
  it("REMOVE range", () => {
    const { state } = t.applyPatch(
      { __type: "array:patch", ops: [{ kind: ARRAY_OP.REMOVE, index: 1, howMany: 2 }] },
      [1, 2, 3, 4]
    );
    expect(state).toEqual([1, 4]);
  });
  it("SET at index", () => {
    const { state } = t.applyPatch(
      { __type: "array:patch", ops: [{ kind: ARRAY_OP.SET, index: 1, items: ["b"] }] },
      ["a", "x", "c"]
    );
    expect(state).toEqual(["a", "b", "c"]);
  });
  it("does not mutate input", () => {
    const original = [1, 2];
    t.applyPatch(
      { __type: "array:patch", ops: [{ kind: ARRAY_OP.INSERT, index: 0, items: [0] }] },
      original
    );
    expect(original).toEqual([1, 2]);
  });
});

describe("ArrayType — contract laws", () => {
  const t = mkType();

  it("identity: applyPatch(noncePatch(), s) == s", () => {
    expect(t.applyPatch(t.noncePatch(), [1, 2, 3]).state).toEqual([1, 2, 3]);
  });

  it("identity: diff(s, s) has no ops", () => {
    expect(t.diff([1, 2], [1, 2]).ops).toEqual([]);
  });

  it("round-trip: append", () => {
    const a = [1, 2];
    const b = [1, 2, 3, 4];
    expect(t.applyPatch(t.diff(a, b), a).state).toEqual(b);
  });

  it("round-trip: truncate", () => {
    const a = [1, 2, 3, 4];
    const b = [1, 2];
    expect(t.applyPatch(t.diff(a, b), a).state).toEqual(b);
  });

  it("round-trip: replace middle", () => {
    const a = [1, 2, 3];
    const b = [1, 9, 3];
    expect(t.applyPatch(t.diff(a, b), a).state).toEqual(b);
  });

  it("recognize", () => {
    expect(t.recognize([])).toEqual(["SUCCESS", "state"]);
    expect(t.recognize({ __type: "array:patch", ops: [] })).toEqual(["SUCCESS", "patch"]);
    expect(t.recognize({ __type: "array:query" })).toEqual(["SUCCESS", "query"]);
  });
});

describe("ArrayType — collate (index adjustment)", () => {
  const t = mkType();

  it("collated patch equals sequential application (insert + insert)", () => {
    const a = [1, 2, 3];
    const p1 = t.diff(a, [0, 1, 2, 3]);
    const mid = t.applyPatch(p1, a).state;
    const p2 = t.diff(mid, [0, 1, 2, 3, 99]);
    const viaCollate = t.applyPatch(t.collate([p1, p2]), a).state;
    const viaSeq = t.applyPatch(p2, t.applyPatch(p1, a).state).state;
    expect(viaCollate).toEqual(viaSeq);
  });

  it("collate of empty patches is nonce", () => {
    expect(t.collate([]).ops).toEqual([]);
  });

  it("collate of single patch returns equivalent", () => {
    const p = new ArrayPatchBuilder().insert(0, [1]).build();
    const collated = t.collate([p]);
    expect(t.applyPatch(collated, []).state).toEqual([1]);
  });
});

describe("ArrayPatchBuilder", () => {
  it("chains operations", () => {
    const p = new ArrayPatchBuilder().insert(0, ["a"]).remove(2, 1).set(1, ["b"]).build();
    expect(p.ops.map((o) => o.kind)).toEqual([ARRAY_OP.INSERT, ARRAY_OP.REMOVE, ARRAY_OP.SET]);
  });
});
