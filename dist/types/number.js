import { DataType, } from "../core.js";
/**
 * A minimal `DataType` for numeric state where both the patch and the
 * diff are plain deltas. Illustrates the "additive group" version of
 * the contract:
 *
 *   - `applyPatch(delta, state)` returns `state + delta`
 *   - `diff(before, after)` returns `after - before`
 *   - `collate(deltas)` sums them (so composition is associative)
 *   - `noncePatch()` / `nonceState()` are both `0`
 *
 * The `query` projection accepts a boolean: `true` returns the current
 * value, `false` returns `undefined`. `fullQuery()` is `true`.
 *
 * Useful on its own for counters, cursors, offsets, or as a building
 * block inside larger types that embed numeric subfields.
 */
export class NumberType extends DataType {
    constructor(typeset, name = "number") {
        super(name, typeset);
    }
    applyPatch(patch, state, _configs) {
        return { state: state + patch };
    }
    diff(before, after, _configs) {
        return after - before;
    }
    collate(patches, _configs) {
        return patches.reduce((a, b) => a + b, 0);
    }
    query(state, query, _configs) {
        return query ? state : undefined;
    }
    recognize(item, _configs) {
        if (typeof item === "number" && Number.isFinite(item)) {
            return ["SUCCESS", "state"];
        }
        return ["ERROR", ["not a finite number"]];
    }
    isState(item, _configs) {
        return typeof item === "number" && Number.isFinite(item);
    }
    isPatch(item, _configs) {
        return typeof item === "number" && Number.isFinite(item);
    }
    isQuery(item, _configs) {
        return typeof item === "boolean";
    }
    convertState(item, _configs) {
        const n = Number(item);
        if (!Number.isFinite(n)) {
            throw new Error(`NumberType: cannot convert ${JSON.stringify(item)} to a finite number`);
        }
        return n;
    }
    convertPatch(item, _configs) {
        return this.convertState(item);
    }
    convertQuery(item, _configs) {
        return Boolean(item);
    }
    noncePatch(_configs) {
        return 0;
    }
    nonceState(_configs) {
        return 0;
    }
    fullQuery(_configs) {
        return true;
    }
    track(cell, onCommit, _configs) {
        const self = this;
        return {
            get value() {
                return cell.get();
            },
            set(n) {
                const before = cell.get();
                const patch = n - before;
                if (patch === 0)
                    return;
                cell.set(self.applyPatch(patch, before).state);
                onCommit(patch, -patch);
            },
            add(delta) {
                if (delta === 0)
                    return;
                const before = cell.get();
                cell.set(self.applyPatch(delta, before).state);
                onCommit(delta, -delta);
            },
        };
    }
}
//# sourceMappingURL=number.js.map