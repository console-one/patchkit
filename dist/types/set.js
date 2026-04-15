import { DataType, } from "../core.js";
export const SET_OP = {
    ADD: "add",
    REMOVE: "remove",
};
export class SetType extends DataType {
    patchLimit = 5;
    constructor(typeset, name = "set") {
        super(name, typeset);
    }
    recognize(item, _configs) {
        if (item === undefined || item === null) {
            return ["ERROR", ["No item provided to recognize."]];
        }
        if (item instanceof Set)
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
        return ["ERROR", [`Unrecognized item for type=${this.name}`]];
    }
    isState(item, _configs) {
        return item instanceof Set;
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
        if (configs?.toFormat === "json") {
            if (item instanceof Set) {
                return JSON.stringify([...item]);
            }
        }
        if (configs?.fromFormat === "json" && typeof item === "string") {
            try {
                const arr = JSON.parse(item);
                if (Array.isArray(arr))
                    return new Set(arr);
            }
            catch {
                // fall through
            }
        }
        if (item instanceof Set)
            return item;
        if (Array.isArray(item))
            return new Set(item);
        return new Set();
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
        return new Set();
    }
    noncePatch(_configs) {
        return { __type: `${this.name}:patch`, ops: [] };
    }
    fullQuery(_configs) {
        return { __type: `${this.name}:query` };
    }
    applyPatch(patch, state, _configs) {
        const next = new Set(state);
        for (const op of patch.ops) {
            switch (op.kind) {
                case SET_OP.ADD:
                    for (const item of op.items)
                        next.add(item);
                    break;
                case SET_OP.REMOVE:
                    for (const item of op.items)
                        next.delete(item);
                    break;
            }
        }
        return { state: next };
    }
    diff(before, after, _configs) {
        const patch = { __type: `${this.name}:patch`, ops: [] };
        const toRemove = [];
        for (const item of before)
            if (!after.has(item))
                toRemove.push(item);
        if (toRemove.length > 0)
            patch.ops.push({ kind: SET_OP.REMOVE, items: toRemove });
        const toAdd = [];
        for (const item of after)
            if (!before.has(item))
                toAdd.push(item);
        if (toAdd.length > 0)
            patch.ops.push({ kind: SET_OP.ADD, items: toAdd });
        return patch;
    }
    collate(patches, _configs) {
        const netAdd = new Set();
        const netRemove = new Set();
        for (const p of patches) {
            for (const op of p.ops) {
                if (op.kind === SET_OP.ADD) {
                    for (const item of op.items) {
                        netRemove.delete(item);
                        netAdd.add(item);
                    }
                }
                else if (op.kind === SET_OP.REMOVE) {
                    for (const item of op.items) {
                        netAdd.delete(item);
                        netRemove.add(item);
                    }
                }
            }
        }
        const ops = [];
        if (netAdd.size > 0)
            ops.push({ kind: SET_OP.ADD, items: [...netAdd] });
        if (netRemove.size > 0)
            ops.push({ kind: SET_OP.REMOVE, items: [...netRemove] });
        return { __type: `${this.name}:patch`, ops };
    }
    query(state, query, _configs) {
        if (query && "has" in query && query.has !== undefined) {
            return state.has(query.has);
        }
        return [...state];
    }
}
export class SetPatchBuilder {
    name;
    ops = [];
    constructor(name = "set") {
        this.name = name;
    }
    add(items, timestamp) {
        const op = { kind: SET_OP.ADD, items };
        if (timestamp !== undefined)
            op.timestamp = timestamp;
        this.ops.push(op);
        return this;
    }
    remove(items, timestamp) {
        const op = { kind: SET_OP.REMOVE, items };
        if (timestamp !== undefined)
            op.timestamp = timestamp;
        this.ops.push(op);
        return this;
    }
    build() {
        return { __type: `${this.name}:patch`, ops: [...this.ops] };
    }
}
//# sourceMappingURL=set.js.map