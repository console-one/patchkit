# patchkit

A polymorphic `DataType` interface for version control over arbitrary data structures, plus reference implementations for **Object**, **Array**, **Set**, and **Source** (text).

Every type implements the same five operations — `applyPatch`, `diff`, `collate`, `query`, `recognize` — so a VCS layer above can work generically against any data structure without knowing what it's versioning.

Also ships **`Ledger`** / **`ledger()`** — a live-mutation wrapper that makes `obj.foo = 'bar'` transparently commit a patch to a history you can inspect and roll back. See [Live tracking](#live-tracking-with-ledger) below.

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

## Live tracking with `Ledger`

The `applyPatch` / `diff` API is pure and functional — you hand in state, you get state back. Sometimes what you actually want is a live object you can mutate the usual way, while the library quietly records what happened so you can inspect the history or undo it.

`ledger()` pairs a `DataType` with a mutable state cell and hands you back a type-appropriate mutable surface. Every mutation on that surface commits a patch (plus its inverse) to an inspectable history. The *shape* of the mutable surface is type-driven: Object hands you a deep recursive Proxy, Array an array Proxy, Set a Set-like handle, Source a text-edit API, Number a value handle. The Ledger itself is just a coordinator — it owns the cell, the history, and rollback.

### Object: deep nested mutation

```ts
import { Typeset, ObjectType, ledger } from "patchkit";

const ts = new Typeset("app");
const type = new ObjectType(ts);

const app = ledger(
  { __type: "object:state", name: "Andrew", settings: { __type: "object:state", theme: "light" } },
  { type },
);

// Flat mutation
app.state.role = "architect";

// Nested mutation — captured as a properly nested ObjectPatch
app.state.settings.theme = "dark";
app.history[1].patch;
// { __type: 'object:patch',
//   settings: { __type: 'object:patch',
//               theme: { command: 'SET', value: 'dark' } } }

app.rollback();                     // reverts the nested change
app.state.settings.theme;           // 'light'
```

### Array, Set, Source, Number

Each type's `track()` exposes the mutating surface that makes sense for that data:

```ts
// ArrayType — array Proxy (push/pop/splice/index-set all intercepted)
const list = ledger([1, 2, 3], { type: new ArrayType(ts) });
list.state.push(4);
list.state.splice(1, 1, 99);
list.rollback(2);

// SetType — Set-like handle
const bag = ledger(new Set([1, 2]), { type: new SetType(ts) });
bag.state.add(3);
bag.state.delete(1);
bag.state.clear();

// Source — edit-submission API
const text = ledger({ text: "hello" }, { type: new Source(ts) });
text.state.insert(5, " world");
text.state.replace(0, 5, "HELLO");

// NumberType — value handle (can't Proxy a primitive)
const counter = ledger(0, { type: new NumberType(ts) });
counter.state.add(3);        // history entry: patch=3, inverse=-3
counter.state.set(10);       // history entry: patch=7, inverse=-7
counter.state.value;         // 10
```

All share the coordinator surface: `app.history`, `app.rollback(n)`, `app.checkpoint()`, `app.restore(handle)`, `app.reset()`, `app.snapshot`.

### What this gives you over manual `diff` / `applyPatch`

- **Ergonomic, type-appropriate mutation**: `obj.foo = 'bar'`, `arr.push(x)`, `set.add(y)`, `text.insert(at, chunk)` — whatever the type's native surface is.
- **Correct inverses captured at mutation time**: each history entry stores both the forward patch and a pre-computed inverse, so rollback of *modifications* — not just adds/deletes — just works.
- **Deep nesting for free on `ObjectType`**: the recursive Proxy turns `state.nested.x.y = z` into a properly nested `object:patch`. No reassign-the-subtree workaround.
- **Inspectable, serializable entries**: each history entry is a real patchkit patch — replayable on any state, shippable over the wire, renderable as an audit trail.
- **Polymorphic**: the Ledger shape is the same regardless of the underlying type.

### Observing commits — sync core, async sinks

Mutation is synchronous by necessity — Proxy `set` traps can't be awaited. That means the Ledger's local state advances on the call stack, without blocking on any downstream persistence, network, or replication. If you want those things, attach a `Sink`:

```ts
const app = ledger(initialState, { type });

const off = app.subscribe({
  async onEntry(entry) {
    await db.append(entry.patch);        // durable log
    // or: await replicator.send(entry.patch)
    // or: await eventBus.emit('patch', entry)
  },
});

app.state.role = "architect";             // returns synchronously
// ...the sink above fires, awaited by the sink internally, not by the Ledger.
```

The Ledger does not await `onEntry`. Returning a Promise is legal but fire-and-forget from the Ledger's perspective. This is a deliberate choice — the Ledger is an in-memory log; backpressure, retry, ordered persistence, and reload-time reconciliation belong in whatever Sink layer you put on top. The Ledger stays honest about what JS Proxies actually support.

Useful Sink shapes:
- **Durable log** — append the patch to disk/DB; flush on shutdown.
- **Replicator** — send each patch over the wire to peers.
- **Optimistic-update coordinator** — mark entries `pending`, confirm/reject asynchronously, call `app.rollback()` on rejection.
- **Observability** — log, metric, or audit-trail each commit.

Rollback does not fire the sink — history pops in place. If your Sink needs "undo" awareness, issue your own forward operations rather than relying on rollback (e.g., `state.role = prior`) so the sink sees the compensating patch as a first-class entry.

## The `DataType` contract

Every `DataType<StateData, PatchData, QueryData, TrackedState>` implements:

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
| `track`         | `(cell, onCommit, configs?) => trackedState`              | Return a type-appropriate mutable handle that emits patches on mutation |

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
