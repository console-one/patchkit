import { describe, it, expect } from "vitest";
import { Typeset } from "../src/core.js";
import { SetType, SetPatchBuilder, SET_OP, type SetPatch } from "../src/types/set.js";

const mkType = () => new SetType(new Typeset("test"));

describe("SetType — recognize/is*", () => {
  const t = mkType();
  it("recognizes JS Set as state", () => {
    expect(t.recognize(new Set([1, 2]))).toEqual(["SUCCESS", "state"]);
  });
  it("recognizes tagged patch", () => {
    expect(t.recognize({ __type: "set:patch", ops: [] })).toEqual(["SUCCESS", "patch"]);
  });
  it("errors on garbage", () => {
    const r = t.recognize(123);
    expect(r[0]).toBe("ERROR");
  });
  it("isState / isPatch / isQuery", () => {
    expect(t.isState(new Set())).toBe(true);
    expect(t.isState({})).toBe(false);
    expect(t.isPatch({ __type: "set:patch", ops: [] })).toBe(true);
    expect(t.isQuery({ __type: "set:query" })).toBe(true);
  });
});

describe("SetType — applyPatch", () => {
  const t = mkType();
  it("ADD extends the set", () => {
    const patch: SetPatch = { __type: "set:patch", ops: [{ kind: SET_OP.ADD, items: [1, 2] }] };
    const { state } = t.applyPatch(patch, new Set([3]));
    expect([...state].sort()).toEqual([1, 2, 3]);
  });
  it("REMOVE shrinks the set", () => {
    const patch: SetPatch = { __type: "set:patch", ops: [{ kind: SET_OP.REMOVE, items: [2] }] };
    const { state } = t.applyPatch(patch, new Set([1, 2, 3]));
    expect([...state].sort()).toEqual([1, 3]);
  });
  it("does not mutate input", () => {
    const original = new Set([1]);
    const patch: SetPatch = { __type: "set:patch", ops: [{ kind: SET_OP.ADD, items: [2] }] };
    t.applyPatch(patch, original);
    expect([...original]).toEqual([1]);
  });
});

describe("SetType — contract laws", () => {
  const t = mkType();

  it("identity: applyPatch(noncePatch(), s) == s", () => {
    const s = new Set([1, 2, 3]);
    const { state } = t.applyPatch(t.noncePatch(), s);
    expect([...state].sort()).toEqual([1, 2, 3]);
  });

  it("identity: diff(s, s) has no ops", () => {
    const s = new Set([1, 2]);
    expect(t.diff(s, s).ops).toEqual([]);
  });

  it("round-trip: applyPatch(diff(a, b), a) deep-equals b", () => {
    const a = new Set([1, 2, 3]);
    const b = new Set([2, 3, 4, 5]);
    const { state } = t.applyPatch(t.diff(a, b), a);
    expect([...state].sort()).toEqual([...b].sort());
  });

  it("collate associativity", () => {
    const a = new Set([1]);
    const b = new Set([1, 2]);
    const c = new Set([2, 3]);
    const p1 = t.diff(a, b);
    const p2 = t.diff(b, c);
    const viaCollate = t.applyPatch(t.collate([p1, p2]), a).state;
    const viaSeq = t.applyPatch(p2, t.applyPatch(p1, a).state).state;
    expect([...viaCollate].sort()).toEqual([...viaSeq].sort());
  });
});

describe("SetType — convert", () => {
  const t = mkType();
  it("state → JSON and back", () => {
    const json = t.convertState(new Set([1, 2]), { toFormat: "json" });
    expect(typeof json).toBe("string");
    const round = t.convertState(json, { fromFormat: "json" });
    expect([...round].sort()).toEqual([1, 2]);
  });
});

describe("SetType — query", () => {
  const t = mkType();
  it("query.has checks membership", () => {
    expect(t.query(new Set([1, 2]), { __type: "set:query", has: 1 })).toBe(true);
    expect(t.query(new Set([1, 2]), { __type: "set:query", has: 9 })).toBe(false);
  });
  it("fullQuery returns all items", () => {
    const result = t.query(new Set([1, 2]), t.fullQuery()) as unknown[];
    expect(result.sort()).toEqual([1, 2]);
  });
});

describe("SetPatchBuilder", () => {
  it("builds an ADD op", () => {
    const p = new SetPatchBuilder().add([1, 2]).build();
    expect(p.ops).toHaveLength(1);
    expect(p.ops[0]?.kind).toBe(SET_OP.ADD);
  });
  it("chains add + remove", () => {
    const p = new SetPatchBuilder("myset").add([1]).remove([2]).build();
    expect(p.__type).toBe("myset:patch");
    expect(p.ops.map((o) => o.kind)).toEqual([SET_OP.ADD, SET_OP.REMOVE]);
  });
});
