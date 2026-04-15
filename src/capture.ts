const CAPTURE_PREFIX = "[@CAPTURE|";
const CAPTURE_SUFFIX = "]";

interface CryptoLike {
  randomUUID?(): string;
}

function randomId(): string {
  const g = globalThis as unknown as { crypto?: CryptoLike };
  if (typeof g.crypto?.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  return `cap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class CaptureGroup {
  readonly id: string;

  constructor(id?: string) {
    this.id = id ?? randomId();
  }

  toJSON(): string {
    return `${CAPTURE_PREFIX}${this.id}${CAPTURE_SUFFIX}`;
  }

  toString(): string {
    return this.toJSON();
  }

  static describesJSON(item: unknown): item is string {
    return (
      typeof item === "string" &&
      item.startsWith(CAPTURE_PREFIX) &&
      item.endsWith(CAPTURE_SUFFIX)
    );
  }

  static fromJSON(item: unknown): CaptureGroup | undefined {
    if (!CaptureGroup.describesJSON(item)) return undefined;
    return new CaptureGroup(item.slice(CAPTURE_PREFIX.length, -CAPTURE_SUFFIX.length));
  }
}

export class CaptureGroupSet {
  private readonly values: Map<string, unknown>;

  constructor() {
    this.values = new Map();
  }

  private keyOf(key: CaptureGroup | string): string {
    return key instanceof CaptureGroup ? key.id : key;
  }

  has(key: CaptureGroup | string): boolean {
    return this.values.has(this.keyOf(key));
  }

  get(key: CaptureGroup | string): unknown {
    return this.values.get(this.keyOf(key));
  }

  set(key: CaptureGroup | string, value: unknown): void {
    const id = this.keyOf(key);
    if (this.values.has(id)) {
      throw new Error(`CaptureGroup '${id}' cannot be set twice (single-assignment)`);
    }
    this.values.set(id, value);
  }

  keys(): string[] {
    return Array.from(this.values.keys());
  }

  size(): number {
    return this.values.size;
  }
}
