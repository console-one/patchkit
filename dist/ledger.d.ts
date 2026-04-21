import type { DataType, PatchConfig } from "./core.js";
/**
 * A single committed mutation in a {@link Ledger}'s history.
 *
 * `patch` is what was applied; `inverse` is what would undo it. Both are
 * ordinary patchkit patches — serializable, replayable, and inspectable
 * through the same `DataType` that produced them.
 */
export interface LedgerEntry<PatchData> {
    patch: PatchData;
    inverse: PatchData;
    at: Date;
}
export interface LedgerOptions<StateData, PatchData> {
    type: DataType<StateData, PatchData, unknown, unknown>;
    /** Optional config forwarded to `type.applyPatch` (on rollback). */
    config?: PatchConfig;
}
/** Opaque handle returned by {@link Ledger.checkpoint}. */
export type Checkpoint = number;
/**
 * A downstream observer of Ledger commits. Called once per entry, in the
 * order entries are committed. The Ledger does not await or serialize
 * `onEntry` — returning a Promise is legal (for async persistence, network
 * replication, etc.) but the Ledger's own state advances synchronously
 * regardless. If you need backpressure, ordered persistence, retry-on-
 * failure, or reload reconciliation, wire those up in a Sink wrapper —
 * the Ledger intentionally stays honest about being an in-memory log.
 */
export interface Sink<PatchData> {
    onEntry(entry: LedgerEntry<PatchData>): void | Promise<void>;
}
/** Handle returned by {@link Ledger.subscribe} to detach a sink. */
export type Unsubscribe = () => void;
/**
 * Coordinates a live mutable state with a replayable patch history. The
 * shape of the mutable surface (`state`) comes from whichever `DataType`
 * you pass in — `ObjectType` hands you a recursively-tracked Proxy,
 * `ArrayType` an array Proxy, `SetType` a Set-like handle, `Source` a
 * text edit API, `NumberType` a value handle, and so on. The Ledger
 * itself only owns the cell, the history log, and rollback.
 *
 * ```ts
 * const app = ledger({ name: 'Andrew', role: 'eng' }, { type: objectType })
 * app.state.role = 'architect'       // committed via ObjectType.track
 * app.state.settings = { theme: 'dark' }
 * app.state.settings.theme = 'light' // captured as a NESTED object patch
 * app.rollback()                      // reverts last entry
 * app.history                         // full log of patches + inverses
 * ```
 */
export declare class Ledger<StateData, PatchData = unknown, TrackedSurface = StateData> {
    private readonly opts;
    private _current;
    private readonly _history;
    private readonly _cell;
    private readonly _sinks;
    readonly state: TrackedSurface;
    constructor(initial: StateData, opts: LedgerOptions<StateData, PatchData>);
    /**
     * Attach a downstream observer. Called once per committed mutation with
     * the `LedgerEntry` (patch + inverse + timestamp). Returns an unsubscribe
     * handle. Sinks are invoked in subscription order; a Promise return is
     * fire-and-forget from the Ledger's perspective.
     *
     * Rollback does NOT retroactively notify sinks — it pops history entries
     * in place. If a sink needs to know about undos, wire that intent through
     * your own entries (e.g., a sink that writes every entry as an append-only
     * event log will see "set" then no "undo" event; design for that).
     */
    subscribe(sink: Sink<PatchData>): Unsubscribe;
    /** Readonly view of every committed mutation, oldest first. */
    get history(): readonly LedgerEntry<PatchData>[];
    /** Current state snapshot (raw, not the tracker surface). */
    get snapshot(): StateData;
    /**
     * Undo the last `n` committed mutations by applying their stored
     * inverses in reverse. Returns the number actually undone (capped by
     * history length).
     */
    rollback(n?: number): number;
    /** Undo everything. */
    reset(): number;
    /**
     * Capture a handle for the current history position. Pair with
     * {@link restore} to rewind to this exact point.
     */
    checkpoint(): Checkpoint;
    /**
     * Rewind to a previously captured {@link Checkpoint}, truncating history
     * back to that point. Returns the number of entries undone.
     */
    restore(checkpoint: Checkpoint): number;
}
/**
 * Construct a Ledger. Type inference flows from `opts.type`'s `TrackedState`
 * parameter to the returned `state` property — pass an `ObjectType` and you
 * get a proxied state; pass a `NumberType` and you get a `NumberHandle`.
 */
export declare function ledger<S, P, T>(initial: S, opts: {
    type: DataType<S, P, unknown, T>;
    config?: PatchConfig;
}): Ledger<S, P, T>;
//# sourceMappingURL=ledger.d.ts.map