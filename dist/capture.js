const CAPTURE_PREFIX = "[@CAPTURE|";
const CAPTURE_SUFFIX = "]";
function randomId() {
    const g = globalThis;
    if (typeof g.crypto?.randomUUID === "function") {
        return g.crypto.randomUUID();
    }
    return `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export class CaptureGroup {
    id;
    constructor(id) {
        this.id = id ?? randomId();
    }
    toJSON() {
        return `${CAPTURE_PREFIX}${this.id}${CAPTURE_SUFFIX}`;
    }
    toString() {
        return this.toJSON();
    }
    static describesJSON(item) {
        return (typeof item === "string" &&
            item.startsWith(CAPTURE_PREFIX) &&
            item.endsWith(CAPTURE_SUFFIX));
    }
    static fromJSON(item) {
        if (!CaptureGroup.describesJSON(item))
            return undefined;
        return new CaptureGroup(item.slice(CAPTURE_PREFIX.length, -CAPTURE_SUFFIX.length));
    }
}
export class CaptureGroupSet {
    values;
    constructor() {
        this.values = new Map();
    }
    keyOf(key) {
        return key instanceof CaptureGroup ? key.id : key;
    }
    has(key) {
        return this.values.has(this.keyOf(key));
    }
    get(key) {
        return this.values.get(this.keyOf(key));
    }
    set(key, value) {
        const id = this.keyOf(key);
        if (this.values.has(id)) {
            throw new Error(`CaptureGroup '${id}' cannot be set twice (single-assignment)`);
        }
        this.values.set(id, value);
    }
    keys() {
        return Array.from(this.values.keys());
    }
    size() {
        return this.values.size;
    }
}
//# sourceMappingURL=capture.js.map