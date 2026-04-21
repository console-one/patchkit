import { DataType, } from "../core.js";
export const ARRAY_OP = {
    INSERT: "insert",
    REMOVE: "remove",
    SET: "set",
};
export class ArrayType extends DataType {
    patchLimit = 5;
    constructor(typeset, name = "array") {
        super(name, typeset);
    }
    recognize(item, _configs) {
        if (item === undefined || item === null)
            return ["ERROR", ["No item provided"]];
        if (Array.isArray(item))
            return ["SUCCESS", "state"];
        if (typeof item === "object") {
            const tag = item.__type;
            if (tag === `${this.name}:patch`)
                return ["SUCCESS", "patch"];
            if (tag === `${this.name}:query`)
                return ["SUCCESS", "query"];
            if (tag === `${this.name}:state`)
                return ["SUCCESS", "state"];
        }
        return ["ERROR", [`Unrecognized ${this.name} data`]];
    }
    isState(item, _configs) {
        return Array.isArray(item);
    }
    isPatch(item, _configs) {
        return (typeof item === "object" &&
            item !== null &&
            item.__type === `${this.name}:patch`);
    }
    isQuery(item, _configs) {
        return (typeof item === "object" &&
            item !== null &&
            item.__type === `${this.name}:query`);
    }
    convertState(item, configs) {
        if (configs?.toFormat === "json" && Array.isArray(item)) {
            return JSON.stringify(item);
        }
        if (configs?.fromFormat === "json" && typeof item === "string") {
            try {
                const parsed = JSON.parse(item);
                if (Array.isArray(parsed))
                    return parsed;
            }
            catch {
                // fall through
            }
        }
        if (Array.isArray(item))
            return item;
        return [];
    }
    convertPatch(item, configs) {
        if (configs?.fromFormat === "json" && typeof item === "string") {
            return JSON.parse(item);
        }
        if (configs?.toFormat === "json" && typeof item === "object") {
            return JSON.stringify(item);
        }
        return item;
    }
    convertQuery(item, configs) {
        if (configs?.fromFormat === "json" && typeof item === "string") {
            return JSON.parse(item);
        }
        if (configs?.toFormat === "json" && typeof item === "object") {
            return JSON.stringify(item);
        }
        return item;
    }
    nonceState(_configs) {
        return [];
    }
    noncePatch(_configs) {
        return { __type: `${this.name}:patch`, ops: [] };
    }
    fullQuery(_configs) {
        return { __type: `${this.name}:query`, ask: "everything" };
    }
    applyPatch(patch, state, _configs) {
        const next = [...state];
        for (const op of patch.ops) {
            switch (op.kind) {
                case ARRAY_OP.INSERT: {
                    const items = op.items ?? [];
                    next.splice(op.index, 0, ...items);
                    break;
                }
                case ARRAY_OP.REMOVE: {
                    const count = op.howMany ?? 1;
                    next.splice(op.index, count);
                    break;
                }
                case ARRAY_OP.SET: {
                    const items = op.items ?? [];
                    for (let i = 0; i < items.length; i++) {
                        const pos = op.index + i;
                        if (pos >= 0 && pos < next.length)
                            next[pos] = items[i];
                    }
                    break;
                }
            }
        }
        return { state: next };
    }
    diff(before, after, _configs) {
        const ops = [];
        const minLen = Math.min(before.length, after.length);
        for (let i = 0; i < minLen; i++) {
            if (JSON.stringify(before[i]) !== JSON.stringify(after[i])) {
                ops.push({ kind: ARRAY_OP.SET, index: i, items: [after[i]] });
            }
        }
        if (after.length > before.length) {
            ops.push({
                kind: ARRAY_OP.INSERT,
                index: before.length,
                items: after.slice(before.length),
            });
        }
        else if (before.length > after.length) {
            ops.push({
                kind: ARRAY_OP.REMOVE,
                index: after.length,
                howMany: before.length - after.length,
            });
        }
        return { __type: `${this.name}:patch`, ops };
    }
    /**
     * Collate multiple ArrayPatches into one equivalent to applying them in sequence.
     * Preserves the index-adjustment logic from the original: when a later op inserts or
     * removes, earlier ops whose indices sit at or past the boundary shift accordingly.
     */
    collate(patches, _configs) {
        if (patches.length === 0)
            return this.noncePatch();
        const first = patches[0];
        if (first === undefined)
            return this.noncePatch();
        let adjusted = [...first.ops];
        for (let i = 1; i < patches.length; i++) {
            const overlay = patches[i];
            if (overlay === undefined)
                continue;
            const afterOps = [...overlay.ops];
            let offset = 0;
            for (const afterOp of afterOps) {
                adjusted = adjusted
                    .map((beforeOp) => {
                    let beforeIndex = beforeOp.index + offset;
                    let beforeItems = beforeOp.items ?? [];
                    if (afterOp.kind === ARRAY_OP.REMOVE) {
                        const removalStart = afterOp.index;
                        const removalCount = afterOp.howMany ?? 1;
                        const removalEnd = removalStart + removalCount;
                        if (beforeOp.kind === ARRAY_OP.INSERT) {
                            const insertionStart = beforeIndex;
                            const insertionEnd = beforeIndex + beforeItems.length;
                            if (insertionStart >= removalStart && insertionEnd <= removalEnd) {
                                return null;
                            }
                            const overlapStart = Math.max(insertionStart, removalStart);
                            const overlapEnd = Math.min(insertionEnd, removalEnd);
                            if (overlapEnd > overlapStart) {
                                const overlapLen = overlapEnd - overlapStart;
                                const startSlice = overlapStart - insertionStart;
                                beforeItems = [
                                    ...beforeItems.slice(0, startSlice),
                                    ...beforeItems.slice(startSlice + overlapLen),
                                ];
                                if (overlapStart === insertionStart) {
                                    beforeIndex = removalEnd;
                                }
                            }
                        }
                        if (beforeIndex >= removalStart) {
                            beforeIndex -= removalCount;
                        }
                    }
                    else if (afterOp.kind === ARRAY_OP.INSERT) {
                        if (beforeIndex >= afterOp.index) {
                            beforeIndex += afterOp.items?.length ?? 0;
                        }
                    }
                    const result = {
                        kind: beforeOp.kind,
                        index: beforeIndex,
                        items: beforeItems,
                    };
                    if (beforeOp.howMany !== undefined)
                        result.howMany = beforeOp.howMany;
                    if (beforeOp.timestamp !== undefined)
                        result.timestamp = beforeOp.timestamp;
                    return result;
                })
                    .filter((op) => op !== null);
                if (afterOp.kind === ARRAY_OP.REMOVE) {
                    offset -= afterOp.howMany ?? 1;
                }
                else if (afterOp.kind === ARRAY_OP.INSERT) {
                    offset += afterOp.items?.length ?? 0;
                }
            }
            adjusted = [...adjusted, ...afterOps];
            adjusted.sort((a, b) => a.index - b.index);
        }
        return { __type: `${this.name}:patch`, ops: adjusted };
    }
    query(state, query, _configs) {
        if (query && typeof query.at === "number")
            return state[query.at];
        return state;
    }
    /**
     * Returns a Proxy over an array-shaped view of the cell. Mutations through
     * any of the following paths are captured as an ArrayPatch:
     *
     *   - index assignment (`arr[i] = v`)  → SET
     *   - `arr.length = n` (truncation)    → REMOVE
     *   - `arr.push(...items)`             → INSERT at end
     *   - `arr.pop()`                      → REMOVE from end
     *   - `arr.shift()`                    → REMOVE from head
     *   - `arr.unshift(...items)`          → INSERT at head
     *   - `arr.splice(at, del, ...items)`  → INSERT/REMOVE composed
     *
     * `onCommit` receives a patch with exactly the ops that were performed
     * plus its inverse (computed from the state before the mutation).
     */
    track(cell, onCommit, _configs) {
        const self = this;
        const typeTag = `${this.name}:patch`;
        const mkPatch = (ops) => ({ __type: typeTag, ops });
        const invertOps = (ops, before) => {
            // Apply each op in sequence against a working copy, and build an inverse.
            // Because the forward patch is constructed from ONE shallow mutation at
            // a time (set, splice, etc.), the ops list is short and the inverse is
            // straightforward.
            const inverse = [];
            const working = [...before];
            for (const op of ops) {
                if (op.kind === ARRAY_OP.INSERT) {
                    const count = op.items?.length ?? 0;
                    inverse.push({ kind: ARRAY_OP.REMOVE, index: op.index, howMany: count });
                    working.splice(op.index, 0, ...(op.items ?? []));
                }
                else if (op.kind === ARRAY_OP.REMOVE) {
                    const count = op.howMany ?? 1;
                    const removed = working.slice(op.index, op.index + count);
                    inverse.push({ kind: ARRAY_OP.INSERT, index: op.index, items: removed });
                    working.splice(op.index, count);
                }
                else if (op.kind === ARRAY_OP.SET) {
                    const items = op.items ?? [];
                    const prior = working.slice(op.index, op.index + items.length);
                    inverse.push({ kind: ARRAY_OP.SET, index: op.index, items: prior });
                    for (let i = 0; i < items.length; i++) {
                        working[op.index + i] = items[i];
                    }
                }
            }
            inverse.reverse();
            return inverse;
        };
        const commit = (ops) => {
            if (ops.length === 0)
                return;
            const before = cell.get();
            const patch = mkPatch(ops);
            const inverse = mkPatch(invertOps(ops, before));
            cell.set(self.applyPatch(patch, before).state);
            onCommit(patch, inverse);
        };
        const indexKey = (key) => {
            if (typeof key !== "string")
                return null;
            if (!/^\d+$/.test(key))
                return null;
            return Number(key);
        };
        const mutatingMethods = {
            push: (...items) => {
                const current = cell.get();
                commit([{ kind: ARRAY_OP.INSERT, index: current.length, items }]);
                return cell.get().length;
            },
            pop: () => {
                const current = cell.get();
                if (current.length === 0)
                    return undefined;
                const last = current[current.length - 1];
                commit([{ kind: ARRAY_OP.REMOVE, index: current.length - 1, howMany: 1 }]);
                return last;
            },
            shift: () => {
                const current = cell.get();
                if (current.length === 0)
                    return undefined;
                const head = current[0];
                commit([{ kind: ARRAY_OP.REMOVE, index: 0, howMany: 1 }]);
                return head;
            },
            unshift: (...items) => {
                commit([{ kind: ARRAY_OP.INSERT, index: 0, items }]);
                return cell.get().length;
            },
            splice: (...args) => {
                const start = args[0];
                const deleteCount = args[1];
                const items = args.slice(2);
                const current = cell.get();
                const len = current.length;
                const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
                const d = deleteCount === undefined ? len - s : Math.max(0, Math.min(deleteCount, len - s));
                const removed = current.slice(s, s + d);
                const ops = [];
                if (d > 0)
                    ops.push({ kind: ARRAY_OP.REMOVE, index: s, howMany: d });
                if (items.length > 0)
                    ops.push({ kind: ARRAY_OP.INSERT, index: s, items });
                commit(ops);
                return removed;
            },
        };
        return new Proxy([], {
            get(_target, key, receiver) {
                if (typeof key === "string" && key in mutatingMethods) {
                    return mutatingMethods[key];
                }
                const current = cell.get();
                return Reflect.get(current, key, receiver);
            },
            set(_target, key, value) {
                if (key === "length") {
                    if (typeof value !== "number")
                        return false;
                    const current = cell.get();
                    if (value < current.length) {
                        commit([{ kind: ARRAY_OP.REMOVE, index: value, howMany: current.length - value }]);
                    }
                    else if (value > current.length) {
                        const padding = new Array(value - current.length).fill(undefined);
                        commit([{ kind: ARRAY_OP.INSERT, index: current.length, items: padding }]);
                    }
                    return true;
                }
                const idx = indexKey(key);
                if (idx === null)
                    return false;
                const current = cell.get();
                if (idx < current.length) {
                    commit([{ kind: ARRAY_OP.SET, index: idx, items: [value] }]);
                }
                else if (idx === current.length) {
                    commit([{ kind: ARRAY_OP.INSERT, index: idx, items: [value] }]);
                }
                else {
                    // sparse assignment; pad with undefineds then set
                    const padding = new Array(idx - current.length).fill(undefined);
                    commit([
                        { kind: ARRAY_OP.INSERT, index: current.length, items: [...padding, value] },
                    ]);
                }
                return true;
            },
            deleteProperty(_target, key) {
                const idx = indexKey(key);
                if (idx === null)
                    return true;
                const current = cell.get();
                if (idx < 0 || idx >= current.length)
                    return true;
                // deleting an index in JS leaves a hole — model as SET to undefined
                commit([{ kind: ARRAY_OP.SET, index: idx, items: [undefined] }]);
                return true;
            },
            has(_target, key) {
                return Reflect.has(cell.get(), key);
            },
            ownKeys() {
                return Reflect.ownKeys(cell.get());
            },
            getOwnPropertyDescriptor(_target, key) {
                return Reflect.getOwnPropertyDescriptor(cell.get(), key);
            },
        });
    }
}
export class ArrayPatchBuilder {
    name;
    ops = [];
    constructor(name = "array") {
        this.name = name;
    }
    insert(index, items, timestamp) {
        const op = { kind: ARRAY_OP.INSERT, index, items };
        if (timestamp !== undefined)
            op.timestamp = timestamp;
        this.ops.push(op);
        return this;
    }
    remove(index, howMany = 1, timestamp) {
        const op = { kind: ARRAY_OP.REMOVE, index, howMany };
        if (timestamp !== undefined)
            op.timestamp = timestamp;
        this.ops.push(op);
        return this;
    }
    set(index, items, timestamp) {
        const op = { kind: ARRAY_OP.SET, index, items };
        if (timestamp !== undefined)
            op.timestamp = timestamp;
        this.ops.push(op);
        return this;
    }
    build() {
        return { __type: `${this.name}:patch`, ops: [...this.ops] };
    }
}
//# sourceMappingURL=array.js.map