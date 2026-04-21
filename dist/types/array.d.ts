import { DataType, type Typeset, type TypesetAssignment, type FormatConfig, type ConvertConfig, type PatchConfig, type DiffConfig, type CollateConfig, type QueryConfig, type RecognizeResult, type OnCommit, type TrackConfig, type StateCell } from "../core.js";
export declare const ARRAY_OP: {
    readonly INSERT: "insert";
    readonly REMOVE: "remove";
    readonly SET: "set";
};
export type ArrayOpKind = (typeof ARRAY_OP)[keyof typeof ARRAY_OP];
export interface ArrayOp {
    kind: ArrayOpKind;
    index: number;
    items?: unknown[];
    howMany?: number;
    timestamp?: number;
}
export interface ArrayPatch {
    __type: string;
    ops: ArrayOp[];
}
export type ArrayState = unknown[];
export interface ArrayQuery {
    __type: string;
    ask?: string;
    at?: number;
}
export declare class ArrayType extends DataType<ArrayState, ArrayPatch, ArrayQuery> {
    patchLimit: number;
    constructor(typeset: Typeset | TypesetAssignment, name?: string);
    recognize(item: unknown, _configs?: FormatConfig): RecognizeResult;
    isState(item: unknown, _configs?: FormatConfig): boolean;
    isPatch(item: unknown, _configs?: FormatConfig): boolean;
    isQuery(item: unknown, _configs?: FormatConfig): boolean;
    convertState(item: unknown, configs?: ConvertConfig): ArrayState;
    convertPatch(item: unknown, configs?: ConvertConfig): ArrayPatch;
    convertQuery(item: unknown, configs?: ConvertConfig): ArrayQuery;
    nonceState(_configs?: FormatConfig): ArrayState;
    noncePatch(_configs?: FormatConfig): ArrayPatch;
    fullQuery(_configs?: FormatConfig): ArrayQuery;
    applyPatch(patch: ArrayPatch, state: ArrayState, _configs?: PatchConfig): {
        state: ArrayState;
    };
    diff(before: ArrayState, after: ArrayState, _configs?: DiffConfig): ArrayPatch;
    /**
     * Collate multiple ArrayPatches into one equivalent to applying them in sequence.
     * Preserves the index-adjustment logic from the original: when a later op inserts or
     * removes, earlier ops whose indices sit at or past the boundary shift accordingly.
     */
    collate(patches: ArrayPatch[], _configs?: CollateConfig): ArrayPatch;
    query(state: ArrayState, query: ArrayQuery, _configs?: QueryConfig): unknown;
    /**
     * Returns a Proxy over an array-shaped view of the cell. Mutations through
     * any of the following paths are captured as an ArrayPatch:
     *
     *   - index assignment (`arr[i] = v`)  → SET
     *   - `arr.length = n` (truncation)    → REMOVE
     *   - `arr.push(...items)`             → INSERT at end
     *   - `arr.pop()`                      → REMOVE from end
     *   - `arr.shift()`                    → REMOVE from head
     *   - `arr.unshift(...items)`          → INSERT at head
     *   - `arr.splice(at, del, ...items)`  → INSERT/REMOVE composed
     *
     * `onCommit` receives a patch with exactly the ops that were performed
     * plus its inverse (computed from the state before the mutation).
     */
    track(cell: StateCell<ArrayState>, onCommit: OnCommit<ArrayPatch>, _configs?: TrackConfig): ArrayState;
}
export declare class ArrayPatchBuilder {
    private readonly name;
    private readonly ops;
    constructor(name?: string);
    insert(index: number, items: unknown[], timestamp?: number): this;
    remove(index: number, howMany?: number, timestamp?: number): this;
    set(index: number, items: unknown[], timestamp?: number): this;
    build(): ArrayPatch;
}
//# sourceMappingURL=array.d.ts.map