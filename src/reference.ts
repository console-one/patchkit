export type ReferenceVersion = "live" | number;

export type ReferenceKind = "Artifact" | "Commit";

export interface ReferenceOptions {
  namespace: string;
  version?: string | number;
}

export interface ReferenceJSON {
  __type: "ref";
  value: string;
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

function isNumericString(s: string): boolean {
  return NUMERIC.test(s);
}

export class Reference {
  readonly namespace: string;
  readonly version: ReferenceVersion;
  readonly referenceType: ReferenceKind;

  constructor(options: string | Reference | ReferenceOptions) {
    if (options instanceof Reference) {
      this.namespace = options.namespace;
      this.version = options.version;
      this.referenceType = options.referenceType;
      return;
    }

    const parsed: ReferenceOptions =
      typeof options === "string" ? Reference.parseString(options) : options;

    const v = parsed.version;
    if (v === undefined) {
      this.version = "live";
      this.referenceType = "Artifact";
    } else if (typeof v === "number") {
      this.version = v;
      this.referenceType = "Commit";
    } else if (typeof v === "string") {
      if (v.toLowerCase() === "live") {
        this.version = "live";
        this.referenceType = "Artifact";
      } else if (isNumericString(v)) {
        this.version = Number(v);
        this.referenceType = "Commit";
      } else {
        throw new Error(
          `Reference version must be a number or the string 'live'; got: ${v}`
        );
      }
    } else {
      throw new Error(`Reference version has unsupported type: ${typeof v}`);
    }

    this.namespace = parsed.namespace;
  }

  get __type(): "ref" {
    return "ref";
  }

  get isLive(): boolean {
    return this.version === "live";
  }

  get versionID(): string {
    return `${this.namespace}#${this.version}`;
  }

  toString(): string {
    return this.versionID;
  }

  toJSON(): ReferenceJSON {
    return { __type: "ref", value: this.versionID };
  }

  equals(other: Reference): boolean {
    return this.namespace === other.namespace && this.version === other.version;
  }

  private static parseString(str: string): ReferenceOptions {
    const hash = str.indexOf("#");
    if (hash < 0) {
      return { namespace: str };
    }
    return {
      namespace: str.slice(0, hash),
      version: str.slice(hash + 1),
    };
  }

  static resolve(item: Reference | string | null | undefined): Reference | undefined {
    if (item === undefined || item === null) return undefined;
    if (item instanceof Reference) return item;
    if (typeof item === "string") return new Reference(item);
    return undefined;
  }

  static fromString(str: string): Reference {
    return new Reference(str);
  }

  static fromJSON(item: unknown): Reference | undefined {
    if (typeof item === "string") {
      try {
        const parsed: unknown = JSON.parse(item);
        return Reference.fromJSON(parsed);
      } catch {
        return Reference.fromString(item);
      }
    }
    if (
      typeof item === "object" &&
      item !== null &&
      (item as { __type?: unknown }).__type === "ref" &&
      typeof (item as { value?: unknown }).value === "string"
    ) {
      return Reference.fromString((item as { value: string }).value);
    }
    return undefined;
  }

  static validate(item: unknown): string[] {
    const errors: string[] = [];
    if (item === undefined || item === null || typeof item !== "object") {
      return ["Item is not an object"];
    }
    const obj = item as Record<string, unknown>;
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

  static describes(item: unknown): boolean {
    return Reference.validate(item).length === 0;
  }
}
