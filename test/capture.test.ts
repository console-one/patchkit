import { describe, it, expect } from "vitest";
import { CaptureGroup, CaptureGroupSet } from "../src/capture.js";

describe("CaptureGroup", () => {
  it("generates unique ids when none provided", () => {
    const a = new CaptureGroup();
    const b = new CaptureGroup();
    expect(a.id).not.toBe(b.id);
  });

  it("serializes to tagged string", () => {
    const c = new CaptureGroup("xyz");
    expect(c.toJSON()).toBe("[@CAPTURE|xyz]");
    expect(c.toString()).toBe("[@CAPTURE|xyz]");
  });

  it("recognizes its own serialized form", () => {
    expect(CaptureGroup.describesJSON("[@CAPTURE|abc]")).toBe(true);
    expect(CaptureGroup.describesJSON("not a capture")).toBe(false);
    expect(CaptureGroup.describesJSON({})).toBe(false);
  });

  it("round-trips through fromJSON", () => {
    const c = new CaptureGroup("roundtrip");
    const parsed = CaptureGroup.fromJSON(c.toJSON());
    expect(parsed?.id).toBe("roundtrip");
  });
});

describe("CaptureGroupSet", () => {
  it("stores and reads values by CaptureGroup or id", () => {
    const set = new CaptureGroupSet();
    const cg = new CaptureGroup("k");
    set.set(cg, 42);
    expect(set.get(cg)).toBe(42);
    expect(set.get("k")).toBe(42);
    expect(set.has("k")).toBe(true);
  });

  it("throws on double assignment (single-assignment semantics)", () => {
    const set = new CaptureGroupSet();
    set.set("k", 1);
    expect(() => set.set("k", 2)).toThrow(/single-assignment/);
  });

  it("reports keys and size", () => {
    const set = new CaptureGroupSet();
    set.set("a", 1);
    set.set("b", 2);
    expect(set.size()).toBe(2);
    expect(set.keys().sort()).toEqual(["a", "b"]);
  });
});
