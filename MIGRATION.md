# Migration notes

Divergences from the source at commit `054f22cf2` (Console One, `server/src/core/lambda-test/vcs/types/`).

## Dependencies

- **Dropped `heap-js`.** `SourceUpdate` used `heap-js` to maintain ordered changes. Replaced with a plain array sorted on construction by `(index asc, inputIndex asc)`. Functionally equivalent for the use case; avoids a runtime dep.
- **Dropped `Artifact` / `repo.ts`.** The original types imported `Artifact<T>` from the VCS layer. None of the keep-list methods actually need it at the type-system level, so the import was removed and `createStateFacade` (which returned `Artifact`-backed proxies) was dropped entirely.
- **Dropped the internal `Configs` class** from `Reference`. The original constructor took a `Configs` parameter for merging; the port makes `Reference` a pure value type. If you need config-carrying behavior, wrap it.
- **Kept `diff-match-patch`** as the sole runtime dep. This is the only thing the brief allowed and the only thing the port actually uses at runtime.

## Proxies removed

The original code used `Proxy` in several places; all were dropped per the spec's "replace the Proxy facade carefully" guidance:

- `Typeset.all` — a `Proxy` getter that let you write `typeset.all.foo`. Replaced with `typeset.get(name)`, `typeset.has(name)`, `typeset.types()`, and `typeset.names()`.
- `ProxiedSetState` (`settype.ts`) — dropped entirely. Use `SetPatchBuilder` to construct patches explicitly.
- `ProxiedArrayState` (`arraytype.ts`) — dropped entirely. Use `ArrayPatchBuilder` or construct `ArrayPatch` literals directly.
- `pushState` / `proxyOverride` / `applyDefault` config threading (used heavily in `patch.ts`, `anytype.ts`, and `objecttype.ts`) — dropped. `applyPatch` now takes a plain `configs` object; for `ObjectType`, a `captureGroups` field is the only context that matters, and it's an explicit property on `PatchConfig`.

## Bug fixes in ported code

- **`ArrayType.applyPatch`:** the original built `newState` as an empty array (`let newState = []`), never seeding it from the input `state`, so every patch application silently dropped the base state. The rewrite starts from `[...state]`.
- **`ArrayType.diff`:** the original attempted sub-patch dispatch via `subPatch.items.length`, which assumed every patch shape had an `items` field. Since different types produce different patch shapes, this was wrong. Sub-type PATCH ops have been dropped from `ArrayType` — use `ObjectType`'s nested-patch mechanism if you need recursive dispatch.
- **`CaptureGroupSet.hasMap`:** `generics/capturegroup.ts` had an inverted check (`this.listeners[key] === undefined`) that made `hasMap` return true precisely when the key *didn't* exist. Irrelevant after the listener machinery was removed, but noted here for provenance.
- **`Reference.fromString`:** the original had an unreachable branch (`if (index < 0 && other !== undefined) new Reference(...)` — no `return`) and constructed `Reference` with a commented-out `configs` parameter. The rewrite uses a single clean parser.
- **`patch.ts`** had literal syntax errors (an unclosed `if` block around line 140 and a mismatched brace) and was dropped wholesale. Its intent is absorbed into `ObjectType.applyPatch` in the rewrite.
- **`AnyType`** — the original file was 315 lines of proxy-threaded state plumbing with a broken `collectErrors` helper (used `this` inside an arrow-function generator). Rewritten from scratch as a ~100-line polymorphic dispatcher that probes the typeset and delegates.

## Semantic changes

- **`ObjectType.applyPatch` is now two-pass.** Pass 1 runs CUT and COPY commands to populate the capture group set; pass 2 runs SET/DELETE/PATCH and resolves capture references. The original interleaved them with a `preCommit` promise array and could deadlock or drop SETs if the referenced CUT hadn't fired yet. The two-pass approach gives deterministic ordering within a single `applyPatch` call.
- **CaptureGroups are synchronous and single-assignment.** The original `CaptureGroupSet` supported async binding via `getValueOrPromise` and a per-key `IndexMap` of listeners. Both were part of the "subscription side effect" machinery the spec said to remove. If you need async binding, do it at the call site: resolve the capture group value before calling `applyPatch`.
- **`Reference` drops the `'live'` / `'number'` / `'number-as-string'` ambiguity** by normalizing on construction: strings that parse as numbers become `number`, the literal `"live"` (case-insensitive) becomes `"live"`, and anything else throws. The original silently accepted bad version strings in some code paths.
- **`ObjectType.diff` emits a canonical `__type` tag** even for empty patches. The original sometimes produced empty objects without the tag, breaking `recognize`. The rewrite always tags.

## Explicit non-ports

- **`metrictype.ts`** was a 0-byte file in the source. Nothing to port.
- **`patch.ts`** (273 lines of broken proxy-threaded patch machinery) — dropped.
- **`vcs/repo.ts`, `vcs/commit.ts`, `vcs/dao.ts`, `vcs/pipe.ts`, `vcs/taskhead.ts`, `vcs/dependency.ts`** — excluded by the salvage brief. These are the VCS layer that "kept collapsing" in the original docs.
- **`DefaultTypeset`** factory from `types/index.ts` — the original constructed it via an idiom that returned constructor functions instead of actually invoking them (the arrow functions never got called). The port omits a default typeset; users register the types they want explicitly.

## Behavioral guarantees the port preserves

- `DataType` interface shape (`applyPatch`, `diff`, `collate`, `query`, `recognize`, `isState`/`isPatch`/`isQuery`, `convertState`/`convertPatch`/`convertQuery`, `noncePatch`/`nonceState`/`fullQuery`).
- `Typeset` single-assignment semantics (adding a type under an existing name is a no-op).
- `CaptureGroup` serialization format: `[@CAPTURE|<id>]`.
- `Reference.versionID` format: `namespace#version`.
- `ArrayType.collate` index-adjustment semantics: later ops shift earlier ops' indices correctly under INSERT/REMOVE.
- All the identity laws (`applyPatch(noncePatch(), s) == s`, `diff(s, s) == noncePatch()`) verified per type by the test suite.
