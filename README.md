# @salvage/c1-datatype

A polymorphic `DataType` interface for version control over arbitrary data structures, plus reference implementations for **Object**, **Array**, **Set**, and **Source** (text).

Every type implements the same five operations — `applyPatch`, `diff`, `collate`, `query`, `recognize` — so a VCS layer above can work generically against any data structure without knowing what it's versioning.

## Install

```bash
npm install @salvage/c1-datatype
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
} from "@salvage/c1-datatype";

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
} from "@salvage/c1-datatype";

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
import { Typeset, SetType, ObjectType, AnyType } from "@salvage/c1-datatype";

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

## Provenance

Extracted from Console One, a collaborative web-based IDE with a custom VCS, build system, multi-language transpiler, and AWS Lambda deployment target. The project spanned roughly four years before being shelved in March 2025. This library salvages the primitives that the original authors flagged as genuinely reusable — the type system design — and rewrites the parts that were too entangled with Proxy-based config threading and subscription machinery to port verbatim.

**Source commit:** `054f22cf2ef636c466d53dee7bbe9e33bf76292a` ("A month and a half of floundering", 2025-03-12)
**Source subtree:** `server/src/core/lambda-test/vcs/types/`

The salvageability analysis is documented in two internal specs:
- `vcs-type-system-extract.md` §8 "If Rebuilding"
- `patch-chain-vcs-spec.md` §10 "Design Recommendations for Reuse"

See `MIGRATION.md` for a full list of intentional divergences from the original source.

## License

MIT © Andrew Chalmers
