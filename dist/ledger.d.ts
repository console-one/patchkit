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
    type: DataType<StateData, PatchData, unknown>;
    /** Optional config forwarded to `type.applyPatch` / `type.diff`. */
    config?: PatchConfig;
}
/** Opaque handle returned by {@link Ledger.checkpoint}. */
export type Checkpoint = number;
/**
 * Wraps a state object in a live Proxy whose mutations are automatically
 * diffed against a {@link DataType}, committed as patches, and appended
 * to an inspectable history. Rollback applies the stored inverses in reverse.
 *
 * The mental model is exactly what IVO was reaching for, but expressed on
 * patchkit's typed patch algebra: you mutate the state like a normal object
 * and you get a running ledger of what changed, with every entry being a
 * real patch you could ship elsewhere.
 *
 * ```ts
 * const app = ledger({ name: 'Andrew', role: 'eng' }, { type: objectType })
 * app.state.role = 'architect'   // committed
 * app.rollback()                 // reverts
 * app.history                    // full log
 * ```
 *
 * **Scope:** the Proxy is shallow. Nested mutations (`state.nested.x = 'y'`)
 * are not captured — reassign the subtree instead (`state.nested = {...}`).
 */
export declare class Ledger<StateData extends object, PatchData = unknown> {
    private readonly opts;
    private _current;
    private readonly _history;
    readonly state: StateData;
    constructor(initial: StateData, opts: LedgerOptions<StateData, PatchData>);
    /** Readonly view of every committed mutation, oldest first. */
    get history(): readonly LedgerEntry<PatchData>[];
    /** Current state snapshot (plain object, not the proxy). */
    get snapshot(): StateData;
    /**
     * Undo the last `n` committed mutations. Returns the number actually
     * undone (capped by history length).
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
    private commit;
    private makeProxy;
}
export declare function ledger<StateData extends object, PatchData = unknown>(initial: StateData, opts: LedgerOptions<StateData, PatchData>): Ledger<StateData, PatchData>;
//# sourceMappingURL=ledger.d.ts.map