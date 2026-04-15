import { describe, it, expect } from "vitest";
import { Typeset } from "../src/core.js";
import { Source, SourceUpdate } from "../src/types/source.js";

const mkType = () => new Source(new Typeset("test"));

describe("Source — applyPatch round-trip", () => {
  const t = mkType();

  it("identity: applyPatch(noncePatch(), s) == s", () => {
    const s = { text: "hello world" };
    expect(t.applyPatch(t.noncePatch(), s).state.text).toBe("hello world");
  });

  it("identity: diff(s, s) is empty", () => {
    const s = { text: "x" };
    expect(t.diff(s, s).length).toBe(0);
  });

  it("round-trip: simple insertion", () => {
    const a = { text: "hello" };
    const b = { text: "hello world" };
    const patch = t.diff(a, b);
    expect(t.applyPatch(patch, a).state.text).toBe("hello world");
  });

  it("round-trip: simple deletion", () => {
    const a = { text: "hello world" };
    const b = { text: "hello" };
    expect(t.applyPatch(t.diff(a, b), a).state.text).toBe("hello");
  });

  it("round-trip: middle replacement", () => {
    const a = { text: "the quick brown fox" };
    const b = { text: "the slow green fox" };
    expect(t.applyPatch(t.diff(a, b), a).state.text).toBe("the slow green fox");
  });

  it("round-trip: full rewrite", () => {
    const a = { text: "abc" };
    const b = { text: "xyz" };
    expect(t.applyPatch(t.diff(a, b), a).state.text).toBe("xyz");
  });
});

describe("Source — recognize / is*", () => {
  const t = mkType();
  it("recognizes string as state", () => {
    expect(t.recognize("hello")).toEqual(["SUCCESS", "state"]);
  });
  it("recognizes SourceText as state", () => {
    expect(t.recognize({ text: "hi" })).toEqual(["SUCCESS", "state"]);
  });
  it("recognizes SourceUpdate instance as patch", () => {
    expect(t.recognize(new SourceUpdate([]))).toEqual(["SUCCESS", "patch"]);
  });
  it("recognizes byIndex query", () => {
    expect(t.recognize({ type: "byIndex", start: 0 })).toEqual(["SUCCESS", "query"]);
  });
});

describe("Source — convert", () => {
  const t = mkType();
  it("convertState lifts raw string", () => {
    expect(t.convertState("hi")).toEqual({ text: "hi" });
  });
  it("convertPatch from array", () => {
    const u = t.convertPatch([{ index: 0, change: "a", type: 0, timestamp: 1 }]);
    expect(u).toBeInstanceOf(SourceUpdate);
  });
});

describe("Source — collate", () => {
  const t = mkType();
  it("collate single patch is equivalent", () => {
    const a = { text: "x" };
    const p = t.diff(a, { text: "xy" });
    expect(t.applyPatch(t.collate([p]), a).state.text).toBe("xy");
  });

  it("collate matches sequential application for disjoint edits", () => {
    const a = { text: "hello" };
    const mid = { text: "hello world" };
    const end = { text: "prefix hello world" };
    const p1 = t.diff(a, mid);
    const p2 = t.diff(mid, end);
    const viaCollate = t.applyPatch(t.collate([p1, p2]), a).state.text;
    const viaSeq = t.applyPatch(p2, t.applyPatch(p1, a).state).state.text;
    expect(viaCollate).toBe(viaSeq);
  });
});

describe("SourceUpdate JSON round-trip", () => {
  it("toJSON + fromJSON", () => {
    const u = new SourceUpdate([{ index: 0, change: "a", type: 0, timestamp: 1 }]);
    const j = u.toJSON();
    const u2 = SourceUpdate.fromJSON(j);
    expect(u2?.length).toBe(1);
    expect(u2?.changes[0]?.change).toBe("a");
  });
});
