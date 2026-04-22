import { DataType, } from "../core.js";
import { CaptureGroup, CaptureGroupSet } from "../capture.js";
export const OBJECT_COMMAND = {
    SET: "SET",
    DELETE: "DELETE",
    CUT: "CUT",
    COPY: "COPY",
    PATCH: "PATCH",
    /**
     * Set the key only if the current state has no value at that key. Otherwise
     * no-op. Atomic analog to `if (state[k] === undefined) state[k] = v`, useful
     * for initialization layers where later writes should win but gaps should be
     * filled.
     */
    DEFAULT: "DEFAULT",
};
export const COLLATE_STRATEGY = {
    OVERRIDE: "OVERRIDE",
    UNDERRIDE: "UNDERRIDE",
};
function isCaptureString(value) {
    return CaptureGroup.describesJSON(value);
}
function resolveStrategy(configs) {
    if (configs === COLLATE_STRATEGY.OVERRIDE || configs === COLLATE_STRATEGY.UNDERRIDE) {
        return configs;
    }
    if (configs && typeof configs === "object") {
        const s = configs.strategy;
        if (s === COLLATE_STRATEGY.OVERRIDE || s === COLLATE_STRATEGY.UNDERRIDE) {
            return s;
        }
    }
    return COLLATE_STRATEGY.OVERRIDE;
}
function isCommand(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const cmd = value.command;
    return (cmd === OBJECT_COMMAND.SET ||
        cmd === OBJECT_COMMAND.DELETE ||
        cmd === OBJECT_COMMAND.CUT ||
        cmd === OBJECT_COMMAND.COPY ||
        cmd === OBJECT_COMMAND.PATCH ||
        cmd === OBJECT_COMMAND.DEFAULT);
}
function isNestedPatch(value, typeName) {
    if (typeof value !== "object" || value === null)
        return false;
    return value.__type === `${typeName}:patch`;
}
function resolveCaptureValue(value, captureGroups) {
    if (!isCaptureString(value))
        return value;
    const cg = CaptureGroup.fromJSON(value);
    if (cg === undefined)
        return value;
    if (!captureGroups.has(cg)) {
        throw new Error(`CaptureGroup '${cg.id}' referenced before bound`);
    }
    return captureGroups.get(cg);
}
export class ObjectType extends DataType {
    patchLimit = 10;
    constructor(typeset, name = "object") {
        super(name, typeset);
    }
    recognize(item, _configs) {
        if (item === undefined || item === null)
            return ["ERROR", ["No item"]];
        if (typeof item !== "object")
            return ["ERROR", ["Not an object"]];
        const tag = item.__type;
        if (tag === `${this.name}:patch`)
            return ["SUCCESS", "patch"];
        if (tag === `${this.name}:state`)
            return ["SUCCESS", "state"];
        if (tag === `${this.name}:query`)
            return ["SUCCESS", "query"];
        return ["SUCCESS", "state"];
    }
    isState(item, _configs) {
        if (typeof item !== "object" || item === null)
            return false;
        const tag = item.__type;
        return tag === undefined || tag === `${this.name}:state`;
    }
    isPatch(item, _configs) {
        if (typeof item !== "object" || item === null)
            return false;
        return item.__type === `${this.name}:patch`;
    }
    isQuery(item, _configs) {
        if (typeof item !== "object" || item === null)
            return false;
        return item.__type === `${this.name}:query`;
    }
    convertState(item, _configs) {
        if (typeof item === "string") {
            try {
                const parsed = JSON.parse(item);
                if (typeof parsed === "object" && parsed !== null)
                    return parsed;
            }
            catch {
                // fall through
            }
        }
        if (typeof item === "object" && item !== null)
            return item;
        return this.nonceState();
    }
    convertPatch(item, _configs) {
        if (typeof item === "string") {
            try {
                return JSON.parse(item);
            }
            catch {
                // fall through
            }
        }
        if (typeof item === "object" && item !== null)
            return item;
        return this.noncePatch();
    }
    convertQuery(item, _configs) {
        if (typeof item === "object" && item !== null)
            return item;
        return this.fullQuery();
    }
    nonceState(_configs) {
        return { __type: `${this.name}:state` };
    }
    noncePatch(_configs) {
        return { __type: `${this.name}:patch` };
    }
    fullQuery(_configs) {
        return { __type: `${this.name}:query` };
    }
    /**
     * Rewrite of the original ObjectType.applyPatch. No proxies, no subscription
     * side effects. Context (captureGroups) is passed explicitly.
     */
    applyPatch(patch, state, configs) {
        const ctx = this.contextFrom(configs);
        const next = { ...state };
        if (state.__type === undefined)
            next.__type = `${this.name}:state`;
        // Pass 1: CUT and COPY to populate capture groups.
        for (const key of Object.keys(patch)) {
            if (key === "__type")
                continue;
            const entry = patch[key];
            if (!isCommand(entry))
                continue;
            if (entry.command === OBJECT_COMMAND.CUT) {
                const cg = CaptureGroup.fromJSON(entry.value);
                if (cg === undefined)
                    throw new Error(`CUT value must be a CaptureGroup string`);
                ctx.captureGroups.set(cg, state[key]);
                delete next[key];
            }
            else if (entry.command === OBJECT_COMMAND.COPY) {
                const cg = CaptureGroup.fromJSON(entry.value);
                if (cg === undefined)
                    throw new Error(`COPY value must be a CaptureGroup string`);
                ctx.captureGroups.set(cg, state[key]);
            }
        }
        // Pass 2: SET, DELETE, PATCH, and nested object-patches.
        for (const key of Object.keys(patch)) {
            if (key === "__type")
                continue;
            const entry = patch[key];
            if (isCommand(entry)) {
                if (entry.command === OBJECT_COMMAND.CUT || entry.command === OBJECT_COMMAND.COPY) {
                    continue;
                }
                if (entry.command === OBJECT_COMMAND.SET) {
                    next[key] = resolveCaptureValue(entry.value, ctx.captureGroups);
                    continue;
                }
                if (entry.command === OBJECT_COMMAND.DELETE) {
                    delete next[key];
                    continue;
                }
                if (entry.command === OBJECT_COMMAND.DEFAULT) {
                    if (state[key] === undefined) {
                        next[key] = resolveCaptureValue(entry.value, ctx.captureGroups);
                    }
                    continue;
                }
                if (entry.command === OBJECT_COMMAND.PATCH) {
                    const currentValue = state[key];
                    const sub = entry.value;
                    if (isNestedPatch(sub, this.name)) {
                        const nestedResult = this.applyPatch(sub, currentValue ?? this.nonceState(), configs);
                        next[key] = nestedResult.state;
                    }
                    else {
                        next[key] = sub;
                    }
                    continue;
                }
            }
            if (isNestedPatch(entry, this.name)) {
                const currentValue = state[key] ?? this.nonceState();
                const nestedResult = this.applyPatch(entry, currentValue, configs);
                next[key] = nestedResult.state;
            }
        }
        return { state: next };
    }
    diff(before, after, _configs) {
        const patch = { __type: `${this.name}:patch` };
        const keys = new Set();
        for (const k of Object.keys(before))
            if (k !== "__type")
                keys.add(k);
        for (const k of Object.keys(after))
            if (k !== "__type")
                keys.add(k);
        for (const key of keys) {
            const a = before[key];
            const b = after[key];
            const inA = key in before;
            const inB = key in after;
            if (inA && !inB) {
                patch[key] = { command: OBJECT_COMMAND.DELETE };
                continue;
            }
            if (!inA && inB) {
                patch[key] = { command: OBJECT_COMMAND.SET, value: b };
                continue;
            }
            if (this.isState(a) && this.isState(b)) {
                const sub = this.diff(a, b);
                if (Object.keys(sub).filter((k) => k !== "__type").length > 0) {
                    patch[key] = sub;
                }
                continue;
            }
            if (JSON.stringify(a) !== JSON.stringify(b)) {
                patch[key] = { command: OBJECT_COMMAND.SET, value: b };
            }
        }
        return patch;
    }
    /**
     * Fuse patches into one. Two strategies are supported:
     *
     *   - `OVERRIDE` (default): later patches override earlier ones at the same key.
     *     This is the intuitive "apply in order, last write wins" semantic.
     *   - `UNDERRIDE`: earlier patches win; later patches only fill in keys the
     *     earlier patch doesn't mention. Useful for applying defaults or
     *     merging partial patches onto an in-progress patch without clobbering.
     *
     * In both strategies, when existing and incoming are BOTH nested ObjectPatches
     * at the same key, collate recurses into them (same strategy propagates).
     *
     * The config argument can be a strategy string directly (`"UNDERRIDE"`) or a
     * config object with `{ strategy }`.
     */
    collate(patches, configs) {
        const strategy = resolveStrategy(configs);
        const result = { __type: `${this.name}:patch` };
        for (const p of patches) {
            for (const key of Object.keys(p)) {
                if (key === "__type")
                    continue;
                const incoming = p[key];
                const existing = result[key];
                if (existing === undefined) {
                    result[key] = incoming;
                    continue;
                }
                if (isNestedPatch(existing, this.name) && isNestedPatch(incoming, this.name)) {
                    result[key] = this.collate([existing, incoming], strategy);
                    continue;
                }
                if (strategy === COLLATE_STRATEGY.UNDERRIDE) {
                    continue;
                }
                result[key] = incoming;
            }
        }
        return result;
    }
    query(state, query, _configs) {
        if (query.keys && Array.isArray(query.keys)) {
            const out = {};
            for (const k of query.keys) {
                if (k in state)
                    out[k] = state[k];
            }
            return out;
        }
        return state;
    }
    contextFrom(configs) {
        if (configs && typeof configs === "object" && "captureGroups" in configs) {
            const cg = configs.captureGroups;
            if (cg instanceof CaptureGroupSet) {
                return { captureGroups: cg };
            }
        }
        return { captureGroups: new CaptureGroupSet() };
    }
    /**
     * Returns a recursively-tracked Proxy over the cell's state. Property sets
     * or deletes — at any nesting depth that is itself an ObjectState — are
     * captured as properly-nested ObjectPatches (and inverses) and reported to
     * `onCommit` after the cell is updated. Inner proxies resolve through a
     * path re-read on each access, so parent reassignments don't strand them.
     */
    track(cell, onCommit, _configs) {
        const self = this;
        const typeTag = `${this.name}:patch`;
        const wrapPatch = (path, leaf) => {
            if (path.length === 0) {
                throw new Error("ObjectType.track: cannot wrap a root-level patch");
            }
            const last = path[path.length - 1];
            let node = { __type: typeTag, [last]: leaf };
            for (let i = path.length - 2; i >= 0; i--) {
                const seg = path[i];
                node = { __type: typeTag, [seg]: node };
            }
            return node;
        };
        const readAt = (path) => {
            let node = cell.get();
            for (const seg of path) {
                node = node[seg];
            }
            return node;
        };
        const commitSetAtPath = (path, key, value) => {
            const parent = readAt(path);
            const had = key in parent;
            const prior = parent[key];
            const setLeaf = { command: OBJECT_COMMAND.SET, value };
            const inverseLeaf = had
                ? { command: OBJECT_COMMAND.SET, value: prior }
                : { command: OBJECT_COMMAND.DELETE };
            const patch = wrapPatch([...path, key], setLeaf);
            const inverse = wrapPatch([...path, key], inverseLeaf);
            cell.set(self.applyPatch(patch, cell.get()).state);
            onCommit(patch, inverse);
        };
        const commitDeleteAtPath = (path, key) => {
            const parent = readAt(path);
            if (!(key in parent))
                return;
            const prior = parent[key];
            const patch = wrapPatch([...path, key], { command: OBJECT_COMMAND.DELETE });
            const inverse = wrapPatch([...path, key], { command: OBJECT_COMMAND.SET, value: prior });
            cell.set(self.applyPatch(patch, cell.get()).state);
            onCommit(patch, inverse);
        };
        const proxyAt = (path) => {
            return new Proxy({}, {
                get(_target, key) {
                    if (typeof key !== "string") {
                        return readAt(path)[key];
                    }
                    const v = readAt(path)[key];
                    if (self.isState(v)) {
                        return proxyAt([...path, key]);
                    }
                    return v;
                },
                set(_target, key, value) {
                    if (typeof key !== "string")
                        return false;
                    commitSetAtPath(path, key, value);
                    return true;
                },
                deleteProperty(_target, key) {
                    if (typeof key !== "string")
                        return true;
                    commitDeleteAtPath(path, key);
                    return true;
                },
                has(_target, key) {
                    return key in readAt(path);
                },
                ownKeys() {
                    return Reflect.ownKeys(readAt(path));
                },
                getOwnPropertyDescriptor(_target, key) {
                    return Reflect.getOwnPropertyDescriptor(readAt(path), key);
                },
            });
        };
        return proxyAt([]);
    }
}
export class ObjectMutator {
    typeName;
    ops = {};
    constructor(typeName = "object") {
        this.typeName = typeName;
    }
    set(key, value) {
        this.ops[key] = { command: OBJECT_COMMAND.SET, value };
        return this;
    }
    delete(key) {
        this.ops[key] = { command: OBJECT_COMMAND.DELETE };
        return this;
    }
    /**
     * Record a DEFAULT command: set the key only if the target state has no
     * value there at apply time. Used to seed initial values without
     * overwriting later-committed ones.
     */
    default(key, value) {
        this.ops[key] = { command: OBJECT_COMMAND.DEFAULT, value };
        return this;
    }
    cut(key, capture) {
        this.ops[key] = { command: OBJECT_COMMAND.CUT, value: capture.toJSON() };
        return this;
    }
    copy(key, capture) {
        this.ops[key] = { command: OBJECT_COMMAND.COPY, value: capture.toJSON() };
        return this;
    }
    patch(key, inner) {
        const m = new ObjectMutator(this.typeName);
        inner(m);
        this.ops[key] = m.build();
        return this;
    }
    build() {
        return { __type: `${this.typeName}:patch`, ...this.ops };
    }
}
//# sourceMappingURL=object.js.map