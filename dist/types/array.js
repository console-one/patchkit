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