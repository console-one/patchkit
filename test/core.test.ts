import { describe, it, expect } from "vitest";
import { DataType, Typeset, type TypesetAssignment, type RecognizeResult } from "../src/core.js";

class NumberType extends DataType<number, number, boolean> {
  constructor(ts: Typeset | TypesetAssignment, name = "number") {
    super(name, ts);
  }
  applyPatch(patch: number, state: number) {
    return { state: state + patch };
  }
  diff(before: number, after: number) {
    return after - before;
  }
  collate(patches: number[]) {
    return patches.reduce((a, b) => a + b, 0);
  }
  query(state: number, _q: boolean) {
    return state;
  }
  recognize(item: unknown): RecognizeResult {
    if (typeof item === "number") return ["SUCCESS", "state"];
    return ["ERROR", ["not a number"]];
  }
  isState(item: unknown) {
    return typeof item === "number";
  }
  isPatch(item: unknown) {
    return typeof item === "number";
  }
  isQuery(item: unknown) {
    return typeof item === "boolean";
  }
  convertState(item: unknown) {
    return Number(item);
  }
  convertPatch(item: unknown) {
    return Number(item);
  }
  convertQuery(item: unknown) {
    return Boolean(item);
  }
  noncePatch() {
    return 0;
  }
  nonceState() {
    return 0;
  }
  fullQuery() {
    return true;
  }
}

describe("Typeset + DataType", () => {
  it("registers a type under its name", () => {
    const ts = new Typeset("test");
    const t = new NumberType(ts);
    expect(ts.has("number")).toBe(true);
    expect(ts.get("number")).toBe(t);
  });

  it("supports TypesetAssignment for custom names", () => {
    const ts = new Typeset("test");
    new NumberType(ts.createAssignment("int"));
    expect(ts.has("int")).toBe(true);
    expect(ts.has("number")).toBe(false);
  });

  it("is idempotent on duplicate registration", () => {
    const ts = new Typeset("test");
    const a = new NumberType(ts);
    new NumberType(ts);
    expect(ts.get("number")).toBe(a);
  });

  it("iterates over types", () => {
    const ts = new Typeset("test");
    new NumberType(ts);
    const arr = [...ts];
    expect(arr).toHaveLength(1);
  });

  it("DataType.toJSON returns typeset namespace", () => {
    const ts = new Typeset("my-ns");
    const t = new NumberType(ts);
    expect(t.toJSON()).toBe("my-ns");
  });

  it("Typeset.toJSON tags itself", () => {
    const ts = new Typeset("ns");
    expect(ts.toJSON()).toEqual({ __type: "typeset", value: "ns" });
  });
});

describe("DataType contract laws (NumberType)", () => {
  const ts = new Typeset("laws");
  const t = new NumberType(ts);

  it("identity: applyPatch(noncePatch(), s) == s", () => {
    expect(t.applyPatch(t.noncePatch(), 5).state).toBe(5);
  });

  it("identity: diff(s, s) == noncePatch()", () => {
    expect(t.diff(7, 7)).toBe(t.noncePatch());
  });

  it("round-trip: applyPatch(diff(a, b), a) == b", () => {
    expect(t.applyPatch(t.diff(3, 10), 3).state).toBe(10);
  });

  it("collate associativity", () => {
    const p1 = t.diff(0, 2);
    const p2 = t.diff(2, 5);
    const collated = t.collate([p1, p2]);
    const viaCollate = t.applyPatch(collated, 0).state;
    const viaApply = t.applyPatch(p2, t.applyPatch(p1, 0).state).state;
    expect(viaCollate).toBe(viaApply);
  });

  it("recognize returns SUCCESS tuple for valid state", () => {
    expect(t.recognize(42)).toEqual(["SUCCESS", "state"]);
  });
});
