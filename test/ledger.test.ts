import { describe, it, expect } from "vitest";
import { Typeset } from "../src/core.js";
import { ObjectType, OBJECT_COMMAND } from "../src/types/object.js";
import { ledger, Ledger } from "../src/ledger.js";

const mkType = () => new ObjectType(new Typeset("test"));

describe("ledger()", () => {
  it("returns a Ledger with a proxied state", () => {
    const app = ledger({ __type: "object:state", name: "Andrew" }, { type: mkType() });
    expect(app).toBeInstanceOf(Ledger);
    expect(app.state.name).toBe("Andrew");
  });

  it("records a SET when a property is assigned", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    app.state.role = "architect";

    expect(app.state.role).toBe("architect");
    expect(app.history).toHaveLength(1);
    const [entry] = app.history;
    expect(entry.patch).toMatchObject({
      role: { command: OBJECT_COMMAND.SET, value: "architect" },
    });
    expect(entry.inverse).toMatchObject({
      role: { command: OBJECT_COMMAND.SET, value: "eng" },
    });
    expect(entry.at).toBeInstanceOf(Date);
  });

  it("records a DELETE when a property is removed", () => {
    const app = ledger(
      { __type: "object:state", name: "Andrew", role: "eng" },
      { type: mkType() },
    );
    delete (app.state as { name?: string }).name;

    expect(app.state.name).toBeUndefined();
    expect(app.history).toHaveLength(1);
    const [entry] = app.history;
    expect(entry.patch).toMatchObject({ name: { command: OBJECT_COMMAND.DELETE } });
    expect(entry.inverse).toMatchObject({
      name: { command: OBJECT_COMMAND.SET, value: "Andrew" },
    });
  });

  it("records a new-key SET whose inverse is DELETE", () => {
    const app = ledger<{ __type?: string; a?: string; b?: string }>(
      { __type: "object:state", a: "x" },
      { type: mkType() },
    );
    app.state.b = "y";

    expect(app.history).toHaveLength(1);
    expect(app.history[0].patch).toMatchObject({
      b: { command: OBJECT_COMMAND.SET, value: "y" },
    });
    expect(app.history[0].inverse).toMatchObject({
      b: { command: OBJECT_COMMAND.DELETE },
    });
  });
});

describe("Ledger rollback", () => {
  it("undoes the most recent mutation", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    app.state.role = "architect";
    expect(app.state.role).toBe("architect");

    expect(app.rollback()).toBe(1);
    expect(app.state.role).toBe("eng");
    expect(app.history).toHaveLength(0);
  });

  it("undoes N mutations in reverse order", () => {
    const app = ledger<{ __type?: string; role?: string; team?: string; name?: string }>(
      { __type: "object:state", name: "Andrew", role: "eng" },
      { type: mkType() },
    );
    app.state.role = "architect";
    app.state.team = "infra";
    delete app.state.name;

    expect(app.rollback(3)).toBe(3);
    expect(app.state.role).toBe("eng");
    expect(app.state.team).toBeUndefined();
    expect(app.state.name).toBe("Andrew");
    expect(app.history).toHaveLength(0);
  });

  it("returns actual undone count when asking for more than history length", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    app.state.role = "architect";
    expect(app.rollback(99)).toBe(1);
    expect(app.history).toHaveLength(0);
  });

  it("rolls back modification (not just add/delete) — the structural fix IVO missed", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    app.state.role = "architect";
    app.state.role = "principal";
    app.state.role = "staff";

    app.rollback();
    expect(app.state.role).toBe("principal");
    app.rollback();
    expect(app.state.role).toBe("architect");
    app.rollback();
    expect(app.state.role).toBe("eng");
  });

  it("reset() undoes everything", () => {
    const app = ledger<{ __type?: string; a?: string; b?: string; c?: string }>(
      { __type: "object:state", a: "1" },
      { type: mkType() },
    );
    app.state.b = "2";
    app.state.c = "3";
    app.state.a = "x";

    expect(app.reset()).toBe(3);
    expect(app.snapshot).toEqual({ __type: "object:state", a: "1" });
  });
});

describe("Ledger checkpoint / restore", () => {
  it("restore() rewinds to a captured point", () => {
    const app = ledger<{ __type?: string; role?: string }>(
      { __type: "object:state", role: "eng" },
      { type: mkType() },
    );
    app.state.role = "architect";
    const save = app.checkpoint();

    app.state.role = "ops";
    app.state.role = "pm";
    expect(app.history).toHaveLength(3);

    expect(app.restore(save)).toBe(2);
    expect(app.state.role).toBe("architect");
    expect(app.history).toHaveLength(1);
  });

  it("restore() is a no-op when already at the checkpoint", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    const save = app.checkpoint();
    expect(app.restore(save)).toBe(0);
  });
});

describe("Ledger proxy surface", () => {
  it("Object.keys enumerates the state's own keys", () => {
    const app = ledger(
      { __type: "object:state", a: 1, b: 2 },
      { type: mkType() },
    );
    expect(Object.keys(app.state).sort()).toEqual(["__type", "a", "b"]);
  });

  it("in operator checks membership", () => {
    const app = ledger(
      { __type: "object:state", role: "eng" },
      { type: mkType() },
    );
    expect("role" in app.state).toBe(true);
    expect("team" in app.state).toBe(false);
  });

  it("snapshot returns the underlying plain object (not the proxy)", () => {
    const app = ledger({ __type: "object:state", x: 1 }, { type: mkType() });
    app.state.x = 2;
    const snap = app.snapshot;
    expect(snap).toEqual({ __type: "object:state", x: 2 });
  });
});
