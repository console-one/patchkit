import { describe, it, expect } from "vitest";
import { Reference } from "../src/reference.js";

describe("Reference", () => {
  it("defaults to live version with Artifact kind", () => {
    const r = new Reference({ namespace: "foo/bar" });
    expect(r.namespace).toBe("foo/bar");
    expect(r.version).toBe("live");
    expect(r.referenceType).toBe("Artifact");
    expect(r.isLive).toBe(true);
  });

  it("accepts numeric version as Commit kind", () => {
    const r = new Reference({ namespace: "foo", version: 42 });
    expect(r.version).toBe(42);
    expect(r.referenceType).toBe("Commit");
    expect(r.isLive).toBe(false);
  });

  it("parses numeric string version", () => {
    const r = new Reference({ namespace: "foo", version: "7" });
    expect(r.version).toBe(7);
    expect(r.referenceType).toBe("Commit");
  });

  it("accepts 'live' string version", () => {
    const r = new Reference({ namespace: "foo", version: "live" });
    expect(r.version).toBe("live");
    expect(r.referenceType).toBe("Artifact");
  });

  it("rejects non-numeric non-live version string", () => {
    expect(() => new Reference({ namespace: "foo", version: "banana" })).toThrow();
  });

  it("parses string namespace without version", () => {
    const r = new Reference("my/ns");
    expect(r.namespace).toBe("my/ns");
    expect(r.isLive).toBe(true);
  });

  it("parses 'namespace#version' strings", () => {
    const r = new Reference("my/ns#12");
    expect(r.namespace).toBe("my/ns");
    expect(r.version).toBe(12);
  });

  it("copies from another Reference", () => {
    const a = new Reference("x/y#3");
    const b = new Reference(a);
    expect(b.versionID).toBe("x/y#3");
  });

  it("toJSON produces canonical shape", () => {
    const r = new Reference("n#1");
    expect(r.toJSON()).toEqual({ __type: "ref", value: "n#1" });
  });

  it("fromJSON round-trips through object form", () => {
    const r = new Reference("n#1");
    const j = r.toJSON();
    const r2 = Reference.fromJSON(j);
    expect(r2?.versionID).toBe("n#1");
  });

  it("fromJSON round-trips through JSON string", () => {
    const r = new Reference("n#1");
    const s = JSON.stringify(r.toJSON());
    const r2 = Reference.fromJSON(s);
    expect(r2?.versionID).toBe("n#1");
  });

  it("resolve accepts string, Reference, nil", () => {
    const r = new Reference("a");
    expect(Reference.resolve(r)).toBe(r);
    expect(Reference.resolve("b")?.namespace).toBe("b");
    expect(Reference.resolve(undefined)).toBeUndefined();
    expect(Reference.resolve(null)).toBeUndefined();
  });

  it("validate + describes", () => {
    const r = new Reference("a#1");
    const j = r.toJSON();
    expect(Reference.validate(j)).toEqual([]);
    expect(Reference.describes(j)).toBe(true);
    expect(Reference.describes({})).toBe(false);
  });

  it("equals compares namespace and version", () => {
    expect(new Reference("a#1").equals(new Reference("a#1"))).toBe(true);
    expect(new Reference("a#1").equals(new Reference("a#2"))).toBe(false);
    expect(new Reference("a").equals(new Reference("a"))).toBe(true);
  });
});
