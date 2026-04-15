# patchkit

A polymorphic `DataType` interface for version control over arbitrary data structures, plus reference implementations for **Object**, **Array**, **Set**, and **Source** (text).

Every type implements the same five operations — `applyPatch`, `diff`, `collate`, `query`, `recognize` — so a VCS layer above can work generically against any data structure without knowing what it's versioning.

## Install

```bash
npm install patchkit
```

One runtime dependency: `diff-match-patch` (used by the `Source` type for text diffing).

## Quick tour

```ts
import {
  Typeset,
  ObjectType,
  ObjectMutator,
  OBJECT_COMMAND,
  CaptureGroup,
  CaptureGroupSet,
} from "patchkit";

const typeset = new Typeset("my-app");
const object = new ObjectType(typeset);

const state = { __type: "object:state", name: "Andrew", role: "engineer" };

// Build a patch with the fluent mutator
const patch = new ObjectMutator()
  .set("role", "architect")
  .delete("tempFlag")
  .build();

const { state: next } = object.applyPatch(patch, state);
// next.role === "architect"
```

### Atomic move with CaptureGroups

```ts
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

object.applyPatch(patch, state, { captureGroups });
// msg1 moved from inbox to archive in a single transaction
```

### Set / Array / Source

```ts
import {
  SetType, SetPatchBuilder,
  ArrayType, ArrayPatchBuilder,
  Source,
  Typeset,
} from "patchkit";

const ts = new Typeset("demo");
const sets = new SetType(ts);
const arrays = new ArrayType(ts);
const source = new Source(ts);

sets.applyPatch(new SetPatchBuilder().add([1, 2]).build(), new Set());
arrays.applyPatch(new ArrayPatchBuilder().insert(0, ["a"]).build(), []);
source.diff({ text: "hello" }, { text: "hello world" });
```

### Polymorphic dispatch with `AnyType`

```ts
import { Typeset, SetType, ObjectType, AnyType } from "patchkit";

const ts = new Typeset("mixed");
new SetType(ts);
new ObjectType(ts);
const any = new AnyType(ts);

any.applyPatch(setPatch, new Set([1, 2]));       // delegates to SetType
any.applyPatch(objectPatch, { __type: "object:state" }); // delegates to ObjectType
```

## The `DataType` contract

Every `DataType<StateData, PatchData, QueryData>` implements:

| Method          | Signature                                                 | Purpose                                         |
| --------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `applyPatch`    | `(patch, state, configs?) => { state }`                   | Produce a new state from a patch                |
| `diff`          | `(before, after, configs?) => patch`                      | Minimal patch transforming `before` into `after`|
| `collate`       | `(patches[], configs?) => patch`                          | Fuse a sequence of patches into one             |
| `query`         | `(state, query, configs?) => result`                      | Read/search state                               |
| `recognize`     | `(item, configs?) => ['SUCCESS', kind] \| ['ERROR', ...]` | Classify an unknown value                       |
| `noncePatch`    | `(configs?) => patch`                                     | Identity patch (no-op)                          |
| `nonceState`    | `(configs?) => state`                                     | Empty state                                     |
| `fullQuery`     | `(configs?) => query`                                     | "Select everything" query                       |

Contract laws enforced by the test suite:

- **Identity:** `applyPatch(noncePatch(), s)` ≡ `s`
- **Identity:** `diff(s, s)` ≡ `noncePatch()`
- **Round-trip:** `applyPatch(diff(a, b), a)` ≡ `b`
- **Collate associativity:** `applyPatch(collate([p1, p2]), s)` ≡ `applyPatch(p2, applyPatch(p1, s))`

## Scope

**What's in:** the type system. You get polymorphic data structures with diff/patch/collate/query/recognize semantics, a typeset registry, References, and CaptureGroups for atomic cross-location moves.

**What's not:** commits, snapshots, persistence, scheduling, remoting. Those are up to whatever VCS, CRDT, or event-sourcing layer you build on top.

## Background

patchkit grew out of a larger IDE project the author worked on for several years. The type system was the most reusable piece — a polymorphic `DataType` interface with per-type patch/diff/collate semantics — and this library extracts and cleans it up for general use. The VCS layer it originally lived inside (commits, snapshots, persistence) is intentionally not included here; those are concerns for whatever storage layer you build on top.

See `MIGRATION.md` for notes on how this version differs from the original implementation.

## License

MIT © Andrew Chalmers
