export type RecognizeResult =
  | ["SUCCESS", "state" | "patch" | "query", string?]
  | ["ERROR", string[]];

export type FormatConfig = { format?: string } & Record<string, unknown>;
export type ConvertConfig = { fromFormat?: string; toFormat?: string } & Record<string, unknown>;
export type QueryConfig = Record<string, unknown>;
export type PatchConfig = Record<string, unknown>;
export type CollateConfig = Record<string, unknown>;
export type DiffConfig = Record<string, unknown>;

export interface DataTypeMethods<StateData = unknown, PatchData = unknown, QueryData = unknown> {
  applyPatch(patch: PatchData, state: StateData, configs?: PatchConfig): { state: StateData };
  diff(before: StateData, after: StateData, configs?: DiffConfig): PatchData;
  collate(patches: PatchData[], configs?: CollateConfig): PatchData;
  query(state: StateData, query: QueryData, configs?: QueryConfig): unknown;
  recognize(item: unknown, configs?: FormatConfig): RecognizeResult;

  isState(item: unknown, configs?: FormatConfig): boolean;
  isPatch(item: unknown, configs?: FormatConfig): boolean;
  isQuery(item: unknown, configs?: FormatConfig): boolean;

  convertState(item: unknown, configs?: ConvertConfig): StateData;
  convertPatch(item: unknown, configs?: ConvertConfig): PatchData;
  convertQuery(item: unknown, configs?: ConvertConfig): QueryData;

  noncePatch(configs?: FormatConfig): PatchData;
  nonceState(configs?: FormatConfig): StateData;
  fullQuery(configs?: FormatConfig): QueryData;
}

export abstract class DataType<StateData = unknown, PatchData = unknown, QueryData = unknown>
  implements DataTypeMethods<StateData, PatchData, QueryData>
{
  readonly name: string;
  typeset: Typeset;
  patchLimit?: number;

  constructor(name: string, typeset: Typeset | TypesetAssignment) {
    this.name = name;
    if (typeset instanceof Typeset) {
      this.typeset = typeset.addType(this);
    } else {
      this.typeset = typeset.consume(this);
    }
  }

  abstract applyPatch(patch: PatchData, state: StateData, configs?: PatchConfig): { state: StateData };
  abstract diff(before: StateData, after: StateData, configs?: DiffConfig): PatchData;
  abstract collate(patches: PatchData[], configs?: CollateConfig): PatchData;
  abstract query(state: StateData, query: QueryData, configs?: QueryConfig): unknown;
  abstract recognize(item: unknown, configs?: FormatConfig): RecognizeResult;

  abstract isState(item: unknown, configs?: FormatConfig): boolean;
  abstract isPatch(item: unknown, configs?: FormatConfig): boolean;
  abstract isQuery(item: unknown, configs?: FormatConfig): boolean;

  abstract convertState(item: unknown, configs?: ConvertConfig): StateData;
  abstract convertPatch(item: unknown, configs?: ConvertConfig): PatchData;
  abstract convertQuery(item: unknown, configs?: ConvertConfig): QueryData;

  abstract noncePatch(configs?: FormatConfig): PatchData;
  abstract nonceState(configs?: FormatConfig): StateData;
  abstract fullQuery(configs?: FormatConfig): QueryData;

  toJSON(): string {
    return this.typeset.namespace;
  }
}

export class Typeset<T extends DataType = DataType> {
  readonly namespace: string;
  private readonly _types: Map<string, T>;

  constructor(namespace: string) {
    this.namespace = namespace;
    this._types = new Map();
  }

  addType(item: T, assignedName?: string): this {
    const name = assignedName ?? item.name;
    if (!this._types.has(name)) {
      this._types.set(name, item);
    }
    return this;
  }

  get(name: string): T | undefined {
    return this._types.get(name);
  }

  has(name: string): boolean {
    return this._types.has(name);
  }

  names(): string[] {
    return Array.from(this._types.keys());
  }

  types(): T[] {
    return Array.from(this._types.values());
  }

  createAssignment(name: string): TypesetAssignment<T> {
    return new TypesetAssignment(this, name);
  }

  [Symbol.iterator](): Iterator<T> {
    return this._types.values();
  }

  toJSON(): { __type: "typeset"; value: string } {
    return { __type: "typeset", value: this.namespace };
  }

  static create<T extends DataType = DataType>(
    namespace: string,
    ...ctors: Array<(ts: Typeset<T>) => T>
  ): Typeset<T> {
    const ts = new Typeset<T>(namespace);
    for (const ctor of ctors) ctor(ts);
    return ts;
  }
}

export class TypesetAssignment<T extends DataType = DataType> {
  constructor(public readonly typeset: Typeset<T>, public readonly name?: string) {}

  consume(type: T): Typeset<T> {
    return this.typeset.addType(type, this.name ?? type.name);
  }
}
