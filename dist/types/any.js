import { DataType, } from "../core.js";
/**
 * Polymorphic dispatcher. Given a Typeset, AnyType recognizes an unknown
 * state/patch/query by asking each registered type in turn, then delegates.
 *
 * This is a clean rewrite of the original `anytype.ts` — the original pulled
 * in proxy-based config threading, an IndexMap of listeners, and a broken
 * `collectErrors` helper. The semantics that actually matter are:
 *   1. recognize an unknown value by probing typeset members
 *   2. delegate apply/diff/collate/query to the matched type
 */
export class AnyType extends DataType {
    constructor(typeset, name = "any") {
        super(name, typeset);
    }
    /** Find the first typeset member (excluding self) whose recognize returns SUCCESS. */
    dispatch(item, kind) {
        for (const candidate of this.typeset.types()) {
            if (candidate === this)
                continue;
            const result = candidate.recognize(item);
            if (result[0] === "SUCCESS" && result[1] === kind)
                return candidate;
        }
        return undefined;
    }
    recognize(item, _configs) {
        for (const candidate of this.typeset.types()) {
            if (candidate === this)
                continue;
            const result = candidate.recognize(item);
            if (result[0] === "SUCCESS")
                return result;
        }
        return ["ERROR", ["No registered type recognized the item"]];
    }
    isState(item, _configs) {
        return this.dispatch(item, "state") !== undefined;
    }
    isPatch(item, _configs) {
        return this.dispatch(item, "patch") !== undefined;
    }
    isQuery(item, _configs) {
        return this.dispatch(item, "query") !== undefined;
    }
    applyPatch(patch, state, configs) {
        const t = this.dispatch(patch, "patch") ?? this.dispatch(state, "state");
        if (t === undefined) {
            throw new Error("AnyType.applyPatch: no registered type matched patch or state");
        }
        return t.applyPatch(patch, state, configs);
    }
    diff(before, after, configs) {
        const t = this.dispatch(before, "state") ?? this.dispatch(after, "state");
        if (t === undefined) {
            throw new Error("AnyType.diff: no registered type matched either state");
        }
        return t.diff(before, after, configs);
    }
    collate(patches, configs) {
        if (patches.length === 0) {
            throw new Error("AnyType.collate: cannot collate an empty patch array");
        }
        const t = this.dispatch(patches[0], "patch");
        if (t === undefined) {
            throw new Error("AnyType.collate: first patch not recognized by any type");
        }
        return t.collate(patches, configs);
    }
    query(state, query, configs) {
        const t = this.dispatch(state, "state");
        if (t === undefined) {
            throw new Error("AnyType.query: state not recognized by any type");
        }
        return t.query(state, query, configs);
    }
    convertState(item, configs) {
        const t = this.dispatch(item, "state");
        return t !== undefined ? t.convertState(item, configs) : item;
    }
    convertPatch(item, configs) {
        const t = this.dispatch(item, "patch");
        return t !== undefined ? t.convertPatch(item, configs) : item;
    }
    convertQuery(item, configs) {
        const t = this.dispatch(item, "query");
        return t !== undefined ? t.convertQuery(item, configs) : item;
    }
    /** AnyType has no meaningful nonce — callers should use a specific type. */
    noncePatch(_configs) {
        return undefined;
    }
    nonceState(_configs) {
        return undefined;
    }
    fullQuery(_configs) {
        return undefined;
    }
}
//# sourceMappingURL=any.js.map