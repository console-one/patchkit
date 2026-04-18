import { describe, it, expect } from "vitest";
import { Typeset } from "../src/core.js";
import { CaptureGroup, CaptureGroupSet } from "../src/capture.js";
import {
  ObjectType,
  ObjectMutator,
  OBJECT_COMMAND,
  COLLATE_STRATEGY,
} from "../src/types/object.js";

const mkType = () => new ObjectType(new Typeset("test"));

describe("ObjectType — simple commands", () => {
  const t = mkType();

  it("SET replaces a property", () => {
    const state = { __type: "object:state", name: "Andrew", role: "engineer" };
    const patch = {
      __type: "object:patch",
      role: { command: OBJECT_COMMAND.SET, value: "architect" },
    };
    const { state: next } = t.applyPatch(patch, state);
    expect(next["role"]).toBe("architect");
    expect(next["name"]).toBe("Andrew");
  });

  it("DELETE removes a property", () => {
    const state = { __type: "object:state", name: "Andrew", tempFlag: true };
    const patch = {
      __type: "object:patch",
      tempFlag: { command: OBJECT_COMMAND.DELETE },
    };
    const { state: next } = t.applyPatch(patch, state);
    expect("tempFlag" in next).toBe(false);
    expect(next["name"]).toBe("Andrew");
  });

  it("SET adds new property", () => {
    const state = { __type: "object:state" };
    const patch = {
      __type: "object:patch",
      hello: { command: OBJECT_COMMAND.SET, value: "world" },
    };
    expect(t.applyPatch(patch, state).state["hello"]).toBe("world");
  });

  it("does not mutate input", () => {
    const state = { __type: "object:state", a: 1 };
    t.applyPatch(
      { __type: "object:patch", a: { command: OBJECT_COMMAND.SET, value: 2 } },
      state
    );
    expect(state["a"]).toBe(1);
  });
});

describe("ObjectType — nested patches", () => {
  const t = mkType();

  it("recursive object patch", () => {
    const state = {
      __type: "object:state",
      settings: { __type: "object:state", theme: "dark", fontSize: 14, deprecated: true },
      version: 3,
    };
    const patch = {
      __type: "object:patch",
      settings: {
        __type: "object:patch",
        fontSize: { command: OBJECT_COMMAND.SET, value: 16 },
        deprecated: { command: OBJECT_COMMAND.DELETE },
        language: { command: OBJECT_COMMAND.SET, value: "en-US" },
      },
      version: { command: OBJECT_COMMAND.SET, value: 4 },
    };
    const { state: next } = t.applyPatch(patch, state);
    const settings = next["settings"] as Record<string, unknown>;
    expect(settings["theme"]).toBe("dark");
    expect(settings["fontSize"]).toBe(16);
    expect("deprecated" in settings).toBe(false);
    expect(settings["language"]).toBe("en-US");
    expect(next["version"]).toBe(4);
  });
});

describe("ObjectType — CUT/COPY with CaptureGroups", () => {
  const t = mkType();

  it("CUT + SET performs atomic move", () => {
    const state = {
      __type: "object:state",
      inbox: { __type: "object:state", msg1: { from: "alice", body: "hello" } },
      archive: { __type: "object:state" },
    };
    const cg = new CaptureGroup("move-msg");
    const captureGroups = new CaptureGroupSet();
    const patch = {
      __type: "object:patch",
      inbox: {
        __type: "object:patch",
        msg1: { command: OBJECT_COMMAND.CUT, value: cg.toJSON() },
      },
      archive: {
        __type: "object:patch",
        msg1: { command: OBJECT_COMMAND.SET, value: cg.toJSON() },
      },
    };
    const { state: next } = t.applyPatch(patch, state, { captureGroups });
    const inbox = next["inbox"] as Record<string, unknown>;
    const archive = next["archive"] as Record<string, unknown>;
    expect("msg1" in inbox).toBe(false);
    expect(archive["msg1"]).toEqual({ from: "alice", body: "hello" });
  });

  it("COPY does not remove the source key", () => {
    const state = {
      __type: "object:state",
      template: "hello",
    };
    const cg = new CaptureGroup("tmpl");
    const patch = {
      __type: "object:patch",
      template: { command: OBJECT_COMMAND.COPY, value: cg.toJSON() },
      instance1: { command: OBJECT_COMMAND.SET, value: cg.toJSON() },
    };
    const { state: next } = t.applyPatch(patch, state, { captureGroups: new CaptureGroupSet() });
    expect(next["template"]).toBe("hello");
    expect(next["instance1"]).toBe("hello");
  });

  it("SET referencing unbound capture group throws", () => {
    const cg = new CaptureGroup("missing");
    const patch = {
      __type: "object:patch",
      x: { command: OBJECT_COMMAND.SET, value: cg.toJSON() },
    };
    expect(() =>
      t.applyPatch(patch, { __type: "object:state" }, { captureGroups: new CaptureGroupSet() })
    ).toThrow();
  });
});

describe("ObjectType — contract laws", () => {
  const t = mkType();

  it("identity: applyPatch(noncePatch(), s) preserves s", () => {
    const s = { __type: "object:state", a: 1, b: 2 };
    const next = t.applyPatch(t.noncePatch(), s).state;
    expect(next["a"]).toBe(1);
    expect(next["b"]).toBe(2);
  });

  it("identity: diff(s, s) has no ops", () => {
    const s = { __type: "object:state", a: 1 };
    const d = t.diff(s, s);
    expect(Object.keys(d).filter((k) => k !== "__type")).toEqual([]);
  });

  it("round-trip: applyPatch(diff(a, b), a) produces b", () => {
    const a = { __type: "object:state", name: "Andrew", role: "engineer", tmp: true };
    const b = { __type: "object:state", name: "Andrew", role: "architect", language: "en" };
    const { state: next } = t.applyPatch(t.diff(a, b), a);
    expect(next["name"]).toBe("Andrew");
    expect(next["role"]).toBe("architect");
    expect("tmp" in next).toBe(false);
    expect(next["language"]).toBe("en");
  });

  it("round-trip: nested object change", () => {
    const a = {
      __type: "object:state",
      settings: { __type: "object:state", theme: "dark", fontSize: 14 },
    };
    const b = {
      __type: "object:state",
      settings: { __type: "object:state", theme: "light", fontSize: 14 },
    };
    const { state: next } = t.applyPatch(t.diff(a, b), a);
    const settings = next["settings"] as Record<string, unknown>;
    expect(settings["theme"]).toBe("light");
    expect(settings["fontSize"]).toBe(14);
  });

  it("collate of two patches == sequential apply", () => {
    const a = { __type: "object:state", x: 1 };
    const p1 = {
      __type: "object:patch",
      x: { command: OBJECT_COMMAND.SET, value: 2 },
    };
    const p2 = {
      __type: "object:patch",
      y: { command: OBJECT_COMMAND.SET, value: 3 },
    };
    const viaCollate = t.applyPatch(t.collate([p1, p2]), a).state;
    const viaSeq = t.applyPatch(p2, t.applyPatch(p1, a).state).state;
    expect(viaCollate["x"]).toBe(viaSeq["x"]);
    expect(viaCollate["y"]).toBe(viaSeq["y"]);
  });
});

describe("ObjectType — collate strategies", () => {
  const t = mkType();

  it("OVERRIDE (default): later patches win at the same key", () => {
    const p1 = {
      __type: "object:patch",
      role: { command: OBJECT_COMMAND.SET, value: "eng" },
    };
    const p2 = {
      __type: "object:patch",
      role: { command: OBJECT_COMMAND.SET, value: "architect" },
    };
    const out = t.collate([p1, p2]);
    expect((out.role as { value: string }).value).toBe("architect");
  });

  it("UNDERRIDE: earlier patches win at the same key", () => {
    const p1 = {
      __type: "object:patch",
      role: { command: OBJECT_COMMAND.SET, value: "eng" },
    };
    const p2 = {
      __type: "object:patch",
      role: { command: OBJECT_COMMAND.SET, value: "architect" },
      team: { command: OBJECT_COMMAND.SET, value: "infra" },
    };
    const out = t.collate([p1, p2], COLLATE_STRATEGY.UNDERRIDE);
    expect((out.role as { value: string }).value).toBe("eng"); // earlier wins
    expect((out.team as { value: string }).value).toBe("infra"); // not in p1, so filled
  });

  it("strategy can be passed as config object with { strategy }", () => {
    const p1 = {
      __type: "object:patch",
      x: { command: OBJECT_COMMAND.SET, value: 1 },
    };
    const p2 = {
      __type: "object:patch",
      x: { command: OBJECT_COMMAND.SET, value: 2 },
    };
    const out = t.collate([p1, p2], { strategy: COLLATE_STRATEGY.UNDERRIDE });
    expect((out.x as { value: number }).value).toBe(1);
  });

  it("recurses into nested patches with the same strategy", () => {
    const p1 = {
      __type: "object:patch",
      settings: {
        __type: "object:patch",
        theme: { command: OBJECT_COMMAND.SET, value: "light" },
      },
    };
    const p2 = {
      __type: "object:patch",
      settings: {
        __type: "object:patch",
        theme: { command: OBJECT_COMMAND.SET, value: "dark" },
        fontSize: { command: OBJECT_COMMAND.SET, value: 14 },
      },
    };
    const overridden = t.collate([p1, p2]);
    const inner = overridden.settings as Record<string, { value?: unknown }>;
    expect((inner.theme as { value: string }).value).toBe("dark");
    expect((inner.fontSize as { value: number }).value).toBe(14);

    const underridden = t.collate([p1, p2], COLLATE_STRATEGY.UNDERRIDE);
    const innerU = underridden.settings as Record<string, { value?: unknown }>;
    expect((innerU.theme as { value: string }).value).toBe("light");
    expect((innerU.fontSize as { value: number }).value).toBe(14);
  });
});

describe("ObjectType — query", () => {
  const t = mkType();
  it("fullQuery returns everything", () => {
    const s = { __type: "object:state", a: 1, b: 2 };
    expect(t.query(s, t.fullQuery())).toBe(s);
  });
  it("query by keys returns projection", () => {
    const s = { __type: "object:state", a: 1, b: 2, c: 3 };
    const q = { __type: "object:query", keys: ["a", "c"] };
    expect(t.query(s, q)).toEqual({ a: 1, c: 3 });
  });
});

describe("ObjectMutator builder", () => {
  it("chains SET and DELETE", () => {
    const p = new ObjectMutator()
      .set("a", 1)
      .delete("b")
      .build();
    expect(p["a"]).toEqual({ command: OBJECT_COMMAND.SET, value: 1 });
    expect(p["b"]).toEqual({ command: OBJECT_COMMAND.DELETE });
  });

  it("builds nested patches via patch()", () => {
    const p = new ObjectMutator()
      .patch("settings", (m) => {
        m.set("theme", "dark");
      })
      .build();
    const inner = p["settings"] as Record<string, unknown>;
    expect(inner["__type"]).toBe("object:patch");
    expect(inner["theme"]).toEqual({ command: OBJECT_COMMAND.SET, value: "dark" });
  });

  it("CUT + COPY with CaptureGroup", () => {
    const cg = new CaptureGroup("x");
    const p = new ObjectMutator().cut("a", cg).copy("b", cg).build();
    expect(p["a"]).toEqual({ command: OBJECT_COMMAND.CUT, value: cg.toJSON() });
    expect(p["b"]).toEqual({ command: OBJECT_COMMAND.COPY, value: cg.toJSON() });
  });
});
