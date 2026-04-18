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
export class Ledger {
    opts;
    _current;
    _history = [];
    state;
    constructor(initial, opts) {
        this.opts = opts;
        this._current = initial;
        this.state = this.makeProxy();
    }
    /** Readonly view of every committed mutation, oldest first. */
    get history() {
        return this._history;
    }
    /** Current state snapshot (plain object, not the proxy). */
    get snapshot() {
        return this._current;
    }
    /**
     * Undo the last `n` committed mutations. Returns the number actually
     * undone (capped by history length).
     */
    rollback(n = 1) {
        let undone = 0;
        for (let i = 0; i < n; i++) {
            const entry = this._history.pop();
            if (!entry)
                break;
            const result = this.opts.type.applyPatch(entry.inverse, this._current, this.opts.config);
            this._current = result.state;
            undone++;
        }
        return undone;
    }
    /** Undo everything. */
    reset() {
        return this.rollback(this._history.length);
    }
    /**
     * Capture a handle for the current history position. Pair with
     * {@link restore} to rewind to this exact point.
     */
    checkpoint() {
        return this._history.length;
    }
    /**
     * Rewind to a previously captured {@link Checkpoint}, truncating history
     * back to that point. Returns the number of entries undone.
     */
    restore(checkpoint) {
        const toUndo = this._history.length - checkpoint;
        if (toUndo <= 0)
            return 0;
        return this.rollback(toUndo);
    }
    commit(before, after) {
        const patch = this.opts.type.diff(before, after, this.opts.config);
        const inverse = this.opts.type.diff(after, before, this.opts.config);
        this._history.push({ patch, inverse, at: new Date() });
    }
    makeProxy() {
        const self = this;
        return new Proxy({}, {
            get(_, key) {
                return self._current[key];
            },
            set(_, key, value) {
                const before = self._current;
                const after = { ...before, [key]: value };
                self.commit(before, after);
                self._current = after;
                return true;
            },
            deleteProperty(_, key) {
                const before = self._current;
                if (!(key in before))
                    return true;
                const after = { ...before };
                delete after[key];
                self.commit(before, after);
                self._current = after;
                return true;
            },
            has(_, key) {
                return key in self._current;
            },
            ownKeys() {
                return Reflect.ownKeys(self._current);
            },
            getOwnPropertyDescriptor(_, key) {
                return Reflect.getOwnPropertyDescriptor(self._current, key);
            },
        });
    }
}
export function ledger(initial, opts) {
    return new Ledger(initial, opts);
}
//# sourceMappingURL=ledger.js.map