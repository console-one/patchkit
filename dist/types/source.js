import DiffMatchPatch from "diff-match-patch";
import { DataType, } from "../core.js";
export const MUTATION = {
    ADDITION: 0,
    DELETION: 1,
};
/**
 * An ordered list of SourceChanges, sorted by (index asc, inputIndex asc).
 * Replaces the `heap-js` dependency from the original with a plain sort.
 */
export class SourceUpdate {
    changes;
    constructor(input = []) {
        const withLen = input.map((c, i) => {
            const copy = {
                ...c,
                __inputIndex: i,
            };
            if (copy.length === undefined)
                copy.length = copy.change.length;
            return copy;
        });
        withLen.sort((a, b) => {
            if (a.index !== b.index)
                return a.index - b.index;
            return a.__inputIndex - b.__inputIndex;
        });
        this.changes = withLen.map(({ __inputIndex: _i, ...rest }) => rest);
    }
    toArray() {
        return [...this.changes];
    }
    toJSON() {
        return { type: "SourceUpdate", value: [...this.changes] };
    }
    static fromJSON(data) {
        if (typeof data === "object" &&
            data !== null &&
            data.type === "SourceUpdate" &&
            Array.isArray(data.value)) {
            return new SourceUpdate(data.value);
        }
        return undefined;
    }
    get length() {
        return this.changes.length;
    }
}
function applySourceUpdate(update, source, direction = "FORWARD") {
    const changes = update.toArray();
    const sourceText = source.text;
    let sourceChangeIndex = 0;
    let characterIndex = 0;
    let newSource = "";
    const deletionKind = direction === "FORWARD" ? MUTATION.DELETION : MUTATION.ADDITION;
    while (characterIndex < sourceText.length || sourceChangeIndex < changes.length) {
        const cursor = changes[sourceChangeIndex];
        if (cursor !== undefined) {
            const nextSourceIndex = cursor.index;
            newSource += sourceText.slice(characterIndex, nextSourceIndex);
            const additions = [];
            const deletions = [];
            while (sourceChangeIndex < changes.length) {
                const curr = changes[sourceChangeIndex];
                if (curr === undefined || curr.index !== nextSourceIndex)
                    break;
                if (curr.type === deletionKind) {
                    deletions.push(curr);
                }
                else {
                    additions.push(curr);
                }
                sourceChangeIndex += 1;
            }
            const deletionLength = deletions.reduce((acc, d) => acc + d.change.length, 0);
            newSource += additions.map((a) => a.change).join("");
            characterIndex = nextSourceIndex + deletionLength;
        }
        else {
            newSource += sourceText.slice(characterIndex);
            characterIndex = sourceText.length;
        }
    }
    return { text: newSource };
}
function diffStrings(a, b) {
    const dmp = new DiffMatchPatch();
    dmp.Diff_Timeout = 4.0;
    const d = dmp.diff_main(a, b);
    dmp.diff_cleanupEfficiency(d);
    const changes = [];
    let offset = 0;
    const timestamp = Date.now();
    for (const [op, text] of d) {
        switch (op) {
            case -1: // DELETE
                changes.push({
                    index: offset,
                    change: text,
                    type: MUTATION.DELETION,
                    timestamp,
                    length: text.length,
                });
                break;
            case 1: // INSERT
                changes.push({
                    index: offset,
                    change: text,
                    type: MUTATION.ADDITION,
                    timestamp,
                    length: text.length,
                });
                offset += text.length;
                break;
            case 0: // EQUAL
                offset += text.length;
                break;
        }
    }
    return new SourceUpdate(changes);
}
function collateUpdates(patches) {
    if (patches.length === 0)
        return new SourceUpdate([]);
    const first = patches[0];
    if (first === undefined)
        return new SourceUpdate([]);
    let merged = first.toArray();
    for (let i = 1; i < patches.length; i++) {
        const overlay = patches[i];
        if (overlay === undefined)
            continue;
        const after = overlay.toArray();
        let offset = 0;
        const now = Date.now();
        for (const changeAfter of after) {
            const afterIndex = changeAfter.index;
            const afterChange = changeAfter.change;
            const afterType = changeAfter.type;
            const next = [];
            for (const b of merged) {
                let beforeIndex = b.index + offset;
                let beforeChange = b.change;
                const beforeType = b.type;
                const beforeTimestamp = b.timestamp || now;
                if (afterType === MUTATION.DELETION) {
                    const deletionStart = afterIndex;
                    const deletionEnd = afterIndex + afterChange.length;
                    if (beforeType === MUTATION.ADDITION) {
                        const insertionEnd = beforeIndex + beforeChange.length;
                        if (beforeIndex >= deletionStart && insertionEnd <= deletionEnd) {
                            continue; // fully absorbed
                        }
                        if (beforeIndex < deletionEnd && insertionEnd > deletionStart) {
                            const overlapLength = Math.min(deletionEnd - beforeIndex, beforeChange.length);
                            beforeChange = beforeChange.slice(overlapLength);
                            beforeIndex = Math.max(beforeIndex, deletionEnd);
                        }
                    }
                    if (beforeIndex >= deletionStart) {
                        beforeIndex -= afterChange.length;
                    }
                }
                else if (afterType === MUTATION.ADDITION) {
                    if (beforeIndex >= afterIndex) {
                        beforeIndex += afterChange.length;
                    }
                }
                next.push({
                    index: beforeIndex,
                    change: beforeChange,
                    type: beforeType,
                    timestamp: beforeTimestamp,
                    length: beforeChange.length,
                });
            }
            merged = next;
            if (afterType === MUTATION.DELETION)
                offset -= afterChange.length;
            else if (afterType === MUTATION.ADDITION)
                offset += afterChange.length;
        }
        merged = [...merged, ...after.map((c) => ({ ...c, timestamp: c.timestamp || now }))];
        merged.sort((x, y) => x.index - y.index);
    }
    return new SourceUpdate(merged);
}
export class Source extends DataType {
    constructor(typeset, name = "file") {
        super(name, typeset);
    }
    applyPatch(patch, state, _configs) {
        return { state: applySourceUpdate(patch, state, "FORWARD") };
    }
    diff(before, after, _configs) {
        return diffStrings(before.text, after.text);
    }
    collate(patches, _configs) {
        return collateUpdates(patches);
    }
    query(state, query, _configs) {
        switch (query.type) {
            case "byIndex": {
                const start = query.start ?? 0;
                const end = query.end ?? state.text.length;
                return state.text.slice(start, end);
            }
            case "summarize":
                return { length: state.text.length };
            default:
                return state.text;
        }
    }
    recognize(item, configs) {
        if (this.isState(item, configs))
            return ["SUCCESS", "state"];
        if (this.isPatch(item, configs))
            return ["SUCCESS", "patch"];
        if (this.isQuery(item, configs))
            return ["SUCCESS", "query"];
        return ["ERROR", ["Unrecognized input for Source"]];
    }
    isState(item, _configs) {
        if (typeof item === "string")
            return true;
        if (typeof item === "object" &&
            item !== null &&
            typeof item.text === "string")
            return true;
        return false;
    }
    isPatch(item, _configs) {
        if (item instanceof SourceUpdate)
            return true;
        if (typeof item === "object" &&
            item !== null &&
            item.type === "SourceUpdate")
            return true;
        return false;
    }
    isQuery(item, _configs) {
        if (typeof item !== "object" || item === null)
            return false;
        const t = item.type;
        return t === "byIndex" || t === "byType" || t === "summarize";
    }
    convertState(item, _configs) {
        if (typeof item === "string")
            return { text: item };
        if (typeof item === "object" &&
            item !== null &&
            typeof item.text === "string") {
            return { text: item.text };
        }
        return { text: "" };
    }
    convertPatch(item, _configs) {
        if (item instanceof SourceUpdate)
            return item;
        if (typeof item === "object" &&
            item !== null &&
            item.type === "SourceUpdate") {
            const parsed = SourceUpdate.fromJSON(item);
            if (parsed !== undefined)
                return parsed;
        }
        if (Array.isArray(item))
            return new SourceUpdate(item);
        if (typeof item === "string") {
            try {
                const parsed = JSON.parse(item);
                const maybe = SourceUpdate.fromJSON(parsed);
                if (maybe !== undefined)
                    return maybe;
            }
            catch {
                // fall through
            }
        }
        return new SourceUpdate([]);
    }
    convertQuery(item, _configs) {
        if (typeof item === "string") {
            try {
                return JSON.parse(item);
            }
            catch {
                return { type: "byIndex", start: 0 };
            }
        }
        return item ?? { type: "byIndex", start: 0 };
    }
    noncePatch(_configs) {
        return new SourceUpdate([]);
    }
    nonceState(_configs) {
        return { text: "" };
    }
    fullQuery(_configs) {
        return { type: "byIndex", start: 0 };
    }
}
//# sourceMappingURL=source.js.map