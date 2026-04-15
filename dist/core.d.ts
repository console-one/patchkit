export type RecognizeResult = ["SUCCESS", "state" | "patch" | "query", string?] | ["ERROR", string[]];
export type FormatConfig = {
    format?: string;
} & Record<string, unknown>;
export type ConvertConfig = {
    fromFormat?: string;
    toFormat?: string;
} & Record<string, unknown>;
export type QueryConfig = Record<string, unknown>;
export type PatchConfig = Record<string, unknown>;
export type CollateConfig = Record<string, unknown>;
export type DiffConfig = Record<string, unknown>;
export interface DataTypeMethods<StateData = unknown, PatchData = unknown, QueryData = unknown> {
    applyPatch(patch: PatchData, state: StateData, configs?: PatchConfig): {
        state: StateData;
    };
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
export declare abstract class DataType<StateData = unknown, PatchData = unknown, QueryData = unknown> implements DataTypeMethods<StateData, PatchData, QueryData> {
    readonly name: string;
    typeset: Typeset;
    patchLimit?: number;
    constructor(name: string, typeset: Typeset | TypesetAssignment);
    abstract applyPatch(patch: PatchData, state: StateData, configs?: PatchConfig): {
        state: StateData;
    };
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
    toJSON(): string;
}
export declare class Typeset<T extends DataType = DataType> {
    readonly namespace: string;
    private readonly _types;
    constructor(namespace: string);
    addType(item: T, assignedName?: string): this;
    get(name: string): T | undefined;
    has(name: string): boolean;
    names(): string[];
    types(): T[];
    createAssignment(name: string): TypesetAssignment<T>;
    [Symbol.iterator](): Iterator<T>;
    toJSON(): {
        __type: "typeset";
        value: string;
    };
    static create<T extends DataType = DataType>(namespace: string, ...ctors: Array<(ts: Typeset<T>) => T>): Typeset<T>;
}
export declare class TypesetAssignment<T extends DataType = DataType> {
    readonly typeset: Typeset<T>;
    readonly name?: string | undefined;
    constructor(typeset: Typeset<T>, name?: string | undefined);
    consume(type: T): Typeset<T>;
}
//# sourceMappingURL=core.d.ts.map