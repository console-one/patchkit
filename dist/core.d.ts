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
export type TrackConfig = Record<string, unknown>;
/**
 * Callback a live-tracker invokes when a mutation has been captured.
 * Receives both the forward patch and its inverse so downstream coordinators
 * (see {@link Ledger}) can record an undoable history without re-diffing.
 */
export type OnCommit<PatchData> = (patch: PatchData, inverse: PatchData) => void;
/**
 * Shared mutable handle for state. A {@link Ledger} (or any other tracker
 * coordinator) owns one of these; the type's `track()` reads through it to
 * stay current and writes through it when applying mutations. Makes the
 * ownership of "the current state" unambiguous between the two.
 */
export interface StateCell<StateData> {
    get(): StateData;
    set(state: StateData): void;
}
export interface DataTypeMethods<StateData = unknown, PatchData = unknown, QueryData = unknown, TrackedState = StateData> {
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
    /**
     * Wrap a state cell in a type-appropriate mutable surface whose mutations
     * are applied through the cell and reported via `onCommit` (forward patch +
     * inverse). Coordinators like {@link Ledger} own the cell; the tracker
     * reads/writes through it so there is no divergence between "what the
     * tracker thinks is current" and "what the Ledger thinks is current".
     *
     * For proxy-able types (Object, Array, Set) the return value is structurally
     * the same as `StateData` — a Proxy you can mutate normally. For primitive
     * or edit-driven types (Number, Source), the return is a handle object with
     * type-specific methods (e.g. `{ set, add }` for numbers; `{ insert, delete,
     * replace }` for text). The shape is declared by each concrete type via the
     * `TrackedState` parameter on {@link DataType}.
     */
    track(cell: StateCell<StateData>, onCommit: OnCommit<PatchData>, configs?: TrackConfig): TrackedState;
}
export declare abstract class DataType<StateData = unknown, PatchData = unknown, QueryData = unknown, TrackedState = StateData> implements DataTypeMethods<StateData, PatchData, QueryData, TrackedState> {
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
    abstract track(cell: StateCell<StateData>, onCommit: OnCommit<PatchData>, configs?: TrackConfig): TrackedState;
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