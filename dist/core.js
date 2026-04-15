export class DataType {
    name;
    typeset;
    patchLimit;
    constructor(name, typeset) {
        this.name = name;
        if (typeset instanceof Typeset) {
            this.typeset = typeset.addType(this);
        }
        else {
            this.typeset = typeset.consume(this);
        }
    }
    toJSON() {
        return this.typeset.namespace;
    }
}
export class Typeset {
    namespace;
    _types;
    constructor(namespace) {
        this.namespace = namespace;
        this._types = new Map();
    }
    addType(item, assignedName) {
        const name = assignedName ?? item.name;
        if (!this._types.has(name)) {
            this._types.set(name, item);
        }
        return this;
    }
    get(name) {
        return this._types.get(name);
    }
    has(name) {
        return this._types.has(name);
    }
    names() {
        return Array.from(this._types.keys());
    }
    types() {
        return Array.from(this._types.values());
    }
    createAssignment(name) {
        return new TypesetAssignment(this, name);
    }
    [Symbol.iterator]() {
        return this._types.values();
    }
    toJSON() {
        return { __type: "typeset", value: this.namespace };
    }
    static create(namespace, ...ctors) {
        const ts = new Typeset(namespace);
        for (const ctor of ctors)
            ctor(ts);
        return ts;
    }
}
export class TypesetAssignment {
    typeset;
    name;
    constructor(typeset, name) {
        this.typeset = typeset;
        this.name = name;
    }
    consume(type) {
        return this.typeset.addType(type, this.name ?? type.name);
    }
}
//# sourceMappingURL=core.js.map