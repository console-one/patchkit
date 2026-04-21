import { describe, it, expect } from "vitest";
import { Typeset } from "../src/core.js";
import { ObjectType, OBJECT_COMMAND } from "../src/types/object.js";
import { ArrayType, ARRAY_OP } from "../src/types/array.js";
import { SetType } from "../src/types/set.js";
import { NumberType } from "../src/types/number.js";
import { Source, MUTATION } from "../src/types/source.js";
import { ledger, Ledger } from "../src/ledger.js";

// ObjectType ------------------------------------------------------------

describe("Ledger<ObjectType> — shallow mutation", () => {
  const mkType = () => new ObjectType(new Typeset("test"));

  it("records a SET when a top-level property is assigned", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    app.state.role = "architect";
    expect(app.state.role).toBe("architect");
    expect(app.history).toHaveLength(1);
    expect(app.history[0].patch).toMatchObject({
      role: { command: OBJECT_COMMAND.SET, value: "architect" },
    });
    expect(app.history[0].inverse).toMatchObject({
      role: { command: OBJECT_COMMAND.SET, value: "eng" },
    });
  });

  it("records a DELETE with an inverse SET to the prior value", () => {
    const app = ledger(
      { __type: "object:state", name: "Andrew" },
      { type: mkType() },
    );
    delete (app.state as { name?: string }).name;
    expect(app.history[0].patch).toMatchObject({ name: { command: OBJECT_COMMAND.DELETE } });
    expect(app.history[0].inverse).toMatchObject({
      name: { command: OBJECT_COMMAND.SET, value: "Andrew" },
    });
  });

  it("rollback undoes the last mutation", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    app.state.role = "architect";
    expect(app.rollback()).toBe(1);
    expect(app.state.role).toBe("eng");
    expect(app.history).toHaveLength(0);
  });

  it("rolls back modifications (not just adds/deletes)", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    app.state.role = "architect";
    app.state.role = "principal";
    app.rollback();
    expect(app.state.role).toBe("architect");
    app.rollback();
    expect(app.state.role).toBe("eng");
  });
});

describe("Ledger<ObjectType> — deep / nested mutation", () => {
  const mkType = () => new ObjectType(new Typeset("test"));

  it("captures nested mutation as a nested object patch", () => {
    const app = ledger(
      {
        __type: "object:state",
        settings: { __type: "object:state", theme: "light", fontSize: 14 },
      },
      { type: mkType() },
    );
    (app.state.settings as { theme: string }).theme = "dark";
    expect(app.history).toHaveLength(1);
    const patch = app.history[0].patch as {
      settings: { __type: string; theme: { command: string; value: string } };
    };
    expect(patch.settings.__type).toBe("object:patch");
    expect(patch.settings.theme).toEqual({ command: OBJECT_COMMAND.SET, value: "dark" });
    const settings = app.state.settings as { theme: string; fontSize: number };
    expect(settings.theme).toBe("dark");
    expect(settings.fontSize).toBe(14);
  });

  it("rolls back a nested modification", () => {
    const app = ledger(
      {
        __type: "object:state",
        settings: { __type: "object:state", theme: "light" },
      },
      { type: mkType() },
    );
    (app.state.settings as { theme: string }).theme = "dark";
    app.rollback();
    expect((app.state.settings as { theme: string }).theme).toBe("light");
  });

  it("captures deep nested set three levels down", () => {
    const app = ledger(
      {
        __type: "object:state",
        a: {
          __type: "object:state",
          b: { __type: "object:state", c: 1 },
        },
      },
      { type: mkType() },
    );
    const a = app.state.a as { b: { c: number } };
    a.b.c = 42;
    const patch = app.history[0].patch as {
      a: { b: { c: { command: string; value: number } } };
    };
    expect(patch.a.b.c).toEqual({ command: OBJECT_COMMAND.SET, value: 42 });
    expect(((app.state.a as { b: { c: number } }).b.c)).toBe(42);
  });
});

// ArrayType ------------------------------------------------------------

describe("Ledger<ArrayType>", () => {
  const mkType = () => new ArrayType(new Typeset("test"));

  it("push records an INSERT at end", () => {
    const app = ledger<unknown[], unknown, unknown[]>([1, 2, 3], { type: mkType() });
    const arr = app.state as number[];
    arr.push(4);
    expect([...arr]).toEqual([1, 2, 3, 4]);
    expect(app.history).toHaveLength(1);
    const patch = app.history[0].patch as { ops: { kind: string; index: number; items?: unknown[] }[] };
    expect(patch.ops[0]).toEqual({ kind: ARRAY_OP.INSERT, index: 3, items: [4] });
  });

  it("rollback of push removes the added item", () => {
    const app = ledger<unknown[], unknown, unknown[]>([1, 2, 3], { type: mkType() });
    (app.state as number[]).push(4, 5);
    app.rollback();
    expect([...(app.state as unknown[])]).toEqual([1, 2, 3]);
  });

  it("index set records a SET with inverse holding prior value", () => {
    const app = ledger<unknown[], unknown, unknown[]>(["a", "b", "c"], { type: mkType() });
    (app.state as string[])[1] = "B";
    expect([...(app.state as unknown[])]).toEqual(["a", "B", "c"]);
    const inv = app.history[0].inverse as { ops: { kind: string; items?: unknown[] }[] };
    expect(inv.ops[0]).toEqual({ kind: ARRAY_OP.SET, index: 1, items: ["b"] });
    app.rollback();
    expect([...(app.state as unknown[])]).toEqual(["a", "b", "c"]);
  });

  it("splice with both delete and insert composes ops", () => {
    const app = ledger<unknown[], unknown, unknown[]>([1, 2, 3, 4, 5], { type: mkType() });
    const removed = (app.state as unknown[]).splice(1, 2, 99, 100);
    expect(removed).toEqual([2, 3]);
    expect([...(app.state as unknown[])]).toEqual([1, 99, 100, 4, 5]);
    app.rollback();
    expect([...(app.state as unknown[])]).toEqual([1, 2, 3, 4, 5]);
  });

  it("pop + shift + unshift survive round-trip rollback", () => {
    const app = ledger<unknown[], unknown, unknown[]>([1, 2, 3], { type: mkType() });
    const arr = app.state as number[];
    arr.push(4);
    arr.pop();
    arr.unshift(0);
    arr.shift();
    expect([...arr]).toEqual([1, 2, 3]);
    app.rollback();
    app.rollback();
    app.rollback();
    app.rollback();
    expect([...(app.state as unknown[])]).toEqual([1, 2, 3]);
  });
});

// SetType ------------------------------------------------------------

describe("Ledger<SetType>", () => {
  const mkType = () => new SetType(new Typeset("test"));

  it("add records an ADD patch; delete records a REMOVE", () => {
    const app = ledger(new Set<number>([1, 2]), { type: mkType() });
    app.state.add(3);
    app.state.delete(1);
    expect([...app.state]).toEqual([2, 3]);
    expect(app.history).toHaveLength(2);
  });

  it("add is a no-op for an existing item (no history entry)", () => {
    const app = ledger(new Set<number>([1, 2]), { type: mkType() });
    app.state.add(1);
    expect(app.history).toHaveLength(0);
  });

  it("delete returns false for an absent item and records nothing", () => {
    const app = ledger(new Set<number>([1]), { type: mkType() });
    expect(app.state.delete(99)).toBe(false);
    expect(app.history).toHaveLength(0);
  });

  it("rollback restores deleted and removes added items", () => {
    const app = ledger(new Set<number>([1, 2]), { type: mkType() });
    app.state.add(3);
    app.state.delete(1);
    app.rollback(); // undo delete
    expect([...app.state].sort()).toEqual([1, 2, 3]);
    app.rollback(); // undo add
    expect([...app.state].sort()).toEqual([1, 2]);
  });

  it("clear rolls back to the pre-clear contents", () => {
    const app = ledger(new Set<number>([1, 2, 3]), { type: mkType() });
    app.state.clear();
    expect([...app.state]).toEqual([]);
    app.rollback();
    expect([...app.state].sort()).toEqual([1, 2, 3]);
  });
});

// NumberType ------------------------------------------------------------

describe("Ledger<NumberType>", () => {
  const mkType = () => new NumberType(new Typeset("test"));

  it("set records a delta patch", () => {
    const app = ledger(10, { type: mkType() });
    app.state.set(15);
    expect(app.state.value).toBe(15);
    expect(app.history[0].patch).toBe(5);
    expect(app.history[0].inverse).toBe(-5);
  });

  it("add records the delta", () => {
    const app = ledger(0, { type: mkType() });
    app.state.add(3);
    app.state.add(-2);
    expect(app.state.value).toBe(1);
    expect(app.history.map((e) => e.patch)).toEqual([3, -2]);
  });

  it("rollback inverts the delta", () => {
    const app = ledger(0, { type: mkType() });
    app.state.add(5);
    app.state.add(10);
    app.rollback();
    expect(app.state.value).toBe(5);
    app.rollback();
    expect(app.state.value).toBe(0);
  });

  it("set(same) is a no-op", () => {
    const app = ledger(7, { type: mkType() });
    app.state.set(7);
    expect(app.history).toHaveLength(0);
  });
});

// Source ------------------------------------------------------------

describe("Ledger<Source>", () => {
  const mkType = () => new Source(new Typeset("test"));

  it("insert adds text at the index", () => {
    const app = ledger({ text: "hello" }, { type: mkType() });
    app.state.insert(5, " world");
    expect(app.state.text).toBe("hello world");
    expect(app.history).toHaveLength(1);
  });

  it("delete removes a span", () => {
    const app = ledger({ text: "hello world" }, { type: mkType() });
    app.state.delete(5, 11);
    expect(app.state.text).toBe("hello");
  });

  it("replace = delete + insert in one commit", () => {
    const app = ledger({ text: "foo bar" }, { type: mkType() });
    app.state.replace(4, 7, "baz");
    expect(app.state.text).toBe("foo baz");
  });

  it("rollback of insert reverts the text", () => {
    const app = ledger({ text: "hi" }, { type: mkType() });
    app.state.insert(2, " there");
    expect(app.state.text).toBe("hi there");
    app.rollback();
    expect(app.state.text).toBe("hi");
  });

  it("rollback of delete restores the removed text", () => {
    const app = ledger({ text: "hello world" }, { type: mkType() });
    app.state.delete(5, 11);
    expect(app.state.text).toBe("hello");
    app.rollback();
    expect(app.state.text).toBe("hello world");
  });

  it("each patch is a SourceUpdate with the right mutation kind", () => {
    const app = ledger({ text: "ab" }, { type: mkType() });
    app.state.insert(2, "c");
    const p = app.history[0].patch;
    expect(p.toArray()[0]?.type).toBe(MUTATION.ADDITION);
    app.state.delete(0, 1);
    const p2 = app.history[1].patch;
    expect(p2.toArray()[0]?.type).toBe(MUTATION.DELETION);
  });
});

// Coordinator features ------------------------------------------------------------

describe("Ledger coordinator features (checkpoint/restore/reset)", () => {
  const mkType = () => new ObjectType(new Typeset("test"));

  it("Ledger constructor creates an instance", () => {
    const app = ledger({ __type: "object:state", x: 1 }, { type: mkType() });
    expect(app).toBeInstanceOf(Ledger);
  });

  it("reset undoes everything", () => {
    const app = ledger({ __type: "object:state", a: 1 }, { type: mkType() });
    (app.state as { b?: number }).b = 2;
    (app.state as { c?: number }).c = 3;
    expect(app.reset()).toBe(2);
    expect(app.snapshot).toEqual({ __type: "object:state", a: 1 });
  });

  it("checkpoint + restore rewinds to the captured point", () => {
    const app = ledger({ __type: "object:state", role: "eng" }, { type: mkType() });
    (app.state as { role: string }).role = "architect";
    const save = app.checkpoint();
    (app.state as { role: string }).role = "pm";
    (app.state as { role: string }).role = "ops";
    expect(app.restore(save)).toBe(2);
    expect((app.state as { role: string }).role).toBe("architect");
    expect(app.history).toHaveLength(1);
  });

  it("restore of current checkpoint is a no-op", () => {
    const app = ledger({ __type: "object:state", x: 1 }, { type: mkType() });
    const save = app.checkpoint();
    expect(app.restore(save)).toBe(0);
  });
});
