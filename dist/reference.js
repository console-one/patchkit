const NUMERIC = /^-?\d+(\.\d+)?$/;
function isNumericString(s) {
    return NUMERIC.test(s);
}
export class Reference {
    namespace;
    version;
    referenceType;
    constructor(options) {
        if (options instanceof Reference) {
            this.namespace = options.namespace;
            this.version = options.version;
            this.referenceType = options.referenceType;
            return;
        }
        const parsed = typeof options === "string" ? Reference.parseString(options) : options;
        const v = parsed.version;
        if (v === undefined) {
            this.version = "live";
            this.referenceType = "Artifact";
        }
        else if (typeof v === "number") {
            this.version = v;
            this.referenceType = "Commit";
        }
        else if (typeof v === "string") {
            if (v.toLowerCase() === "live") {
                this.version = "live";
                this.referenceType = "Artifact";
            }
            else if (isNumericString(v)) {
                this.version = Number(v);
                this.referenceType = "Commit";
            }
            else {
                throw new Error(`Reference version must be a number or the string 'live'; got: ${v}`);
            }
        }
        else {
            throw new Error(`Reference version has unsupported type: ${typeof v}`);
        }
        this.namespace = parsed.namespace;
    }
    get __type() {
        return "ref";
    }
    get isLive() {
        return this.version === "live";
    }
    get versionID() {
        return `${this.namespace}#${this.version}`;
    }
    toString() {
        return this.versionID;
    }
    toJSON() {
        return { __type: "ref", value: this.versionID };
    }
    equals(other) {
        return this.namespace === other.namespace && this.version === other.version;
    }
    static parseString(str) {
        const hash = str.indexOf("#");
        if (hash < 0) {
            return { namespace: str };
        }
        return {
            namespace: str.slice(0, hash),
            version: str.slice(hash + 1),
        };
    }
    static resolve(item) {
        if (item === undefined || item === null)
            return undefined;
        if (item instanceof Reference)
            return item;
        if (typeof item === "string")
            return new Reference(item);
        return undefined;
    }
    static fromString(str) {
        return new Reference(str);
    }
    static fromJSON(item) {
        if (typeof item === "string") {
            try {
                const parsed = JSON.parse(item);
                return Reference.fromJSON(parsed);
            }
            catch {
                return Reference.fromString(item);
            }
        }
        if (typeof item === "object" &&
            item !== null &&
            item.__type === "ref" &&
            typeof item.value === "string") {
            return Reference.fromString(item.value);
        }
        return undefined;
    }
    static validate(item) {
        const errors = [];
        if (item === undefined || item === null || typeof item !== "object") {
            return ["Item is not an object"];
        }
        const obj = item;
        if (obj["__type"] !== "ref") {
            errors.push("Missing __type='ref' field");
        }
        const hasValue = typeof obj["value"] === "string";
        const hasNamespace = typeof obj["namespace"] === "string";
        if (!hasValue && !hasNamespace) {
            errors.push("Missing string 'value' or 'namespace' field");
        }
        return errors;
    }
    static describes(item) {
        return Reference.validate(item).length === 0;
    }
}
//# sourceMappingURL=reference.js.map