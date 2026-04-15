import { describe, it, expect } from "vitest";
import { Typeset } from "../src/core.js";
import { SetType, SET_OP } from "../src/types/set.js";
import { ArrayType, ARRAY_OP } from "../src/types/array.js";
import { ObjectType, OBJECT_COMMAND } from "../src/types/object.js";
import { AnyType } from "../src/types/any.js";

function mkRegistry() {
  const ts = new Typeset("any-test");
  new SetType(ts);
  new ArrayType(ts);
  new ObjectType(ts);
  const any = new AnyType(ts);
  return { ts, any };
}

describe("AnyType — dispatch", () => {
  it("recognizes Set state and delegates applyPatch", () => {
    const { any } = mkRegistry();
    const state = new Set([1, 2]);
    const patch = { __type: "set:patch", ops: [{ kind: SET_OP.ADD, items: [3] }] };
    const { state: next } = any.applyPatch(patch, state);
    expect([...(next as Set<number>)].sort()).toEqual([1, 2, 3]);
  });

  it("recognizes Array state and delegates applyPatch", () => {
    const { any } = mkRegistry();
    const state = [1, 2];
    const patch = {
      __type: "array:patch",
      ops: [{ kind: ARRAY_OP.INSERT, index: 2, items: [3] }],
    };
    const { state: next } = any.applyPatch(patch, state);
    expect(next).toEqual([1, 2, 3]);
  });

  it("recognizes Object state and delegates applyPatch", () => {
    const { any } = mkRegistry();
    const state = { __type: "object:state", a: 1 };
    const patch = {
      __type: "object:patch",
      a: { command: OBJECT_COMMAND.SET, value: 2 },
    };
    const { state: next } = any.applyPatch(patch, state);
    expect((next as Record<string, unknown>)["a"]).toBe(2);
  });

  it("diff dispatches by state type", () => {
    const { any } = mkRegistry();
    const a = new Set([1]);
    const b = new Set([1, 2]);
    const patch = any.diff(a, b) as { __type: string };
    expect(patch.__type).toBe("set:patch");
  });

  it("query dispatches by state type", () => {
    const { any } = mkRegistry();
    const state = new Set([1, 2]);
    const result = any.query(state, { __type: "set:query", has: 1 });
    expect(result).toBe(true);
  });

  it("recognize returns SUCCESS for the matched type", () => {
    const { any } = mkRegistry();
    expect(any.recognize(new Set([1]))).toEqual(["SUCCESS", "state"]);
    expect(any.recognize([1, 2])).toEqual(["SUCCESS", "state"]);
    expect(any.recognize({ __type: "object:patch" })).toEqual(["SUCCESS", "patch"]);
  });

  it("recognize returns ERROR when nothing matches", () => {
    const ts = new Typeset("empty");
    const any = new AnyType(ts);
    const result = any.recognize("random string");
    expect(result[0]).toBe("ERROR");
  });

  it("applyPatch throws when no type matches", () => {
    const ts = new Typeset("empty");
    const any = new AnyType(ts);
    expect(() => any.applyPatch({}, {})).toThrow();
  });
});
