import { describe, it, expect } from "vitest";
import { Typeset } from "../src/core.js";
import { NumberType } from "../src/types/number.js";

const mkType = () => new NumberType(new Typeset("test"));

describe("NumberType — basics", () => {
  it("registers under the default name 'number'", () => {
    const ts = new Typeset("app");
    const t = new NumberType(ts);
    expect(ts.get("number")).toBe(t);
  });

  it("accepts a custom name via TypesetAssignment", () => {
    const ts = new Typeset("app");
    new NumberType(ts.createAssignment("counter"));
    expect(ts.has("counter")).toBe(true);
    expect(ts.has("number")).toBe(false);
  });

  it("applyPatch adds the delta to state", () => {
    const t = mkType();
    expect(t.applyPatch(3, 5).state).toBe(8);
    expect(t.applyPatch(-4, 10).state).toBe(6);
  });

  it("diff returns after - before", () => {
    const t = mkType();
    expect(t.diff(5, 12)).toBe(7);
    expect(t.diff(10, 4)).toBe(-6);
  });

  it("collate sums deltas", () => {
    const t = mkType();
    expect(t.collate([1, 2, 3, 4])).toBe(10);
    expect(t.collate([])).toBe(0);
  });

  it("query returns state iff the query is true", () => {
    const t = mkType();
    expect(t.query(42, true)).toBe(42);
    expect(t.query(42, false)).toBeUndefined();
  });
});

describe("NumberType — classification", () => {
  const t = mkType();

  it("recognize SUCCESS for finite numbers", () => {
    expect(t.recognize(0)).toEqual(["SUCCESS", "state"]);
    expect(t.recognize(-3.14)).toEqual(["SUCCESS", "state"]);
  });

  it("recognize ERROR for non-finite / non-number", () => {
    expect(t.recognize("5")[0]).toBe("ERROR");
    expect(t.recognize(NaN)[0]).toBe("ERROR");
    expect(t.recognize(Infinity)[0]).toBe("ERROR");
    expect(t.recognize(null)[0]).toBe("ERROR");
  });

  it("isState / isPatch / isQuery predicates", () => {
    expect(t.isState(1)).toBe(true);
    expect(t.isState("1")).toBe(false);
    expect(t.isPatch(0)).toBe(true);
    expect(t.isQuery(true)).toBe(true);
    expect(t.isQuery(1)).toBe(false);
  });

  it("convertState coerces and validates", () => {
    expect(t.convertState("3")).toBe(3);
    expect(t.convertState(5)).toBe(5);
    expect(() => t.convertState("abc")).toThrow();
  });

  it("nonce values are 0; fullQuery is true", () => {
    expect(t.noncePatch()).toBe(0);
    expect(t.nonceState()).toBe(0);
    expect(t.fullQuery()).toBe(true);
  });
});

describe("NumberType — contract laws", () => {
  const t = mkType();

  it("identity: applyPatch(noncePatch(), s) == s", () => {
    expect(t.applyPatch(t.noncePatch(), 7).state).toBe(7);
  });

  it("identity: diff(s, s) == noncePatch()", () => {
    expect(t.diff(9, 9)).toBe(t.noncePatch());
  });

  it("round-trip: applyPatch(diff(a, b), a) == b", () => {
    expect(t.applyPatch(t.diff(3, 11), 3).state).toBe(11);
  });

  it("collate associativity matches sequential apply", () => {
    const p1 = t.diff(0, 4);
    const p2 = t.diff(4, 9);
    const collated = t.collate([p1, p2]);
    const viaCollate = t.applyPatch(collated, 0).state;
    const viaApply = t.applyPatch(p2, t.applyPatch(p1, 0).state).state;
    expect(viaCollate).toBe(viaApply);
    expect(viaCollate).toBe(9);
  });
});
