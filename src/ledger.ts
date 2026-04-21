import type { DataType, PatchConfig, StateCell } from "./core.js";

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
export class Ledger<StateData, PatchData = unknown, TrackedSurface = StateData> {
  private _current: StateData;
  private readonly _history: LedgerEntry<PatchData>[] = [];
  private readonly _cell: StateCell<StateData>;
  public readonly state: TrackedSurface;

  constructor(
    initial: StateData,
    private readonly opts: LedgerOptions<StateData, PatchData>,
  ) {
    this._current = initial;
    this._cell = {
      get: () => this._current,
      set: (s: StateData) => {
        this._current = s;
      },
    };
    this.state = opts.type.track(this._cell, (patch, inverse) => {
      this._history.push({ patch, inverse, at: new Date() });
    }) as TrackedSurface;
  }

  /** Readonly view of every committed mutation, oldest first. */
  get history(): readonly LedgerEntry<PatchData>[] {
    return this._history;
  }

  /** Current state snapshot (raw, not the tracker surface). */
  get snapshot(): StateData {
    return this._current;
  }

  /**
   * Undo the last `n` committed mutations by applying their stored
   * inverses in reverse. Returns the number actually undone (capped by
   * history length).
   */
  rollback(n: number = 1): number {
    let undone = 0;
    for (let i = 0; i < n; i++) {
      const entry = this._history.pop();
      if (!entry) break;
      const result = this.opts.type.applyPatch(
        entry.inverse,
        this._current,
        this.opts.config,
      );
      this._current = result.state;
      undone++;
    }
    return undone;
  }

  /** Undo everything. */
  reset(): number {
    return this.rollback(this._history.length);
  }

  /**
   * Capture a handle for the current history position. Pair with
   * {@link restore} to rewind to this exact point.
   */
  checkpoint(): Checkpoint {
    return this._history.length;
  }

  /**
   * Rewind to a previously captured {@link Checkpoint}, truncating history
   * back to that point. Returns the number of entries undone.
   */
  restore(checkpoint: Checkpoint): number {
    const toUndo = this._history.length - checkpoint;
    if (toUndo <= 0) return 0;
    return this.rollback(toUndo);
  }
}

/**
 * Construct a Ledger. Type inference flows from `opts.type`'s `TrackedState`
 * parameter to the returned `state` property — pass an `ObjectType` and you
 * get a proxied state; pass a `NumberType` and you get a `NumberHandle`.
 */
export function ledger<S, P, T>(
  initial: S,
  opts: { type: DataType<S, P, unknown, T>; config?: PatchConfig },
): Ledger<S, P, T> {
  return new Ledger<S, P, T>(initial, opts);
}
