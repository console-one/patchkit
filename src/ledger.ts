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
export class Ledger<StateData extends object, PatchData = unknown> {
  private _current: StateData;
  private readonly _history: LedgerEntry<PatchData>[] = [];
  public readonly state: StateData;

  constructor(
    initial: StateData,
    private readonly opts: LedgerOptions<StateData, PatchData>,
  ) {
    this._current = initial;
    this.state = this.makeProxy();
  }

  /** Readonly view of every committed mutation, oldest first. */
  get history(): readonly LedgerEntry<PatchData>[] {
    return this._history;
  }

  /** Current state snapshot (plain object, not the proxy). */
  get snapshot(): StateData {
    return this._current;
  }

  /**
   * Undo the last `n` committed mutations. Returns the number actually
   * undone (capped by history length).
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

  private commit(before: StateData, after: StateData): void {
    const patch = this.opts.type.diff(before, after, this.opts.config);
    const inverse = this.opts.type.diff(after, before, this.opts.config);
    this._history.push({ patch, inverse, at: new Date() });
  }

  private makeProxy(): StateData {
    const self = this;
    return new Proxy({} as StateData, {
      get(_, key) {
        return (self._current as Record<string | symbol, unknown>)[key as string | symbol];
      },
      set(_, key, value) {
        const before = self._current;
        const after = { ...(before as object), [key]: value } as StateData;
        self.commit(before, after);
        self._current = after;
        return true;
      },
      deleteProperty(_, key) {
        const before = self._current;
        if (!(key in (before as object))) return true;
        const after = { ...(before as object) } as Record<string | symbol, unknown>;
        delete after[key as string | symbol];
        self.commit(before, after as StateData);
        self._current = after as StateData;
        return true;
      },
      has(_, key) {
        return key in (self._current as object);
      },
      ownKeys() {
        return Reflect.ownKeys(self._current as object);
      },
      getOwnPropertyDescriptor(_, key) {
        return Reflect.getOwnPropertyDescriptor(self._current as object, key);
      },
    }) as StateData;
  }
}

export function ledger<StateData extends object, PatchData = unknown>(
  initial: StateData,
  opts: LedgerOptions<StateData, PatchData>,
): Ledger<StateData, PatchData> {
  return new Ledger(initial, opts);
}
