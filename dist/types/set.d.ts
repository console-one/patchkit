import { DataType, type Typeset, type TypesetAssignment, type FormatConfig, type ConvertConfig, type PatchConfig, type DiffConfig, type CollateConfig, type QueryConfig, type RecognizeResult } from "../core.js";
export declare const SET_OP: {
    readonly ADD: "add";
    readonly REMOVE: "remove";
};
export type SetOpKind = (typeof SET_OP)[keyof typeof SET_OP];
export interface SetOp {
    kind: SetOpKind;
    items: unknown[];
    timestamp?: number;
}
export interface SetPatch {
    __type: string;
    ops: SetOp[];
}
export interface SetQuery {
    __type: string;
    has?: unknown;
}
export type SetState = Set<unknown>;
export declare class SetType extends DataType<SetState, SetPatch, SetQuery> {
    patchLimit: number;
    constructor(typeset: Typeset | TypesetAssignment, name?: string);
    recognize(item: unknown, _configs?: FormatConfig): RecognizeResult;
    isState(item: unknown, _configs?: FormatConfig): boolean;
    isPatch(item: unknown, _configs?: FormatConfig): boolean;
    isQuery(item: unknown, _configs?: FormatConfig): boolean;
    convertState(item: unknown, configs?: ConvertConfig): SetState;
    convertPatch(item: unknown, configs?: ConvertConfig): SetPatch;
    convertQuery(item: unknown, configs?: ConvertConfig): SetQuery;
    nonceState(_configs?: FormatConfig): SetState;
    noncePatch(_configs?: FormatConfig): SetPatch;
    fullQuery(_configs?: FormatConfig): SetQuery;
    applyPatch(patch: SetPatch, state: SetState, _configs?: PatchConfig): {
        state: SetState;
    };
    diff(before: SetState, after: SetState, _configs?: DiffConfig): SetPatch;
    collate(patches: SetPatch[], _configs?: CollateConfig): SetPatch;
    query(state: SetState, query: SetQuery, _configs?: QueryConfig): unknown;
}
export declare class SetPatchBuilder {
    private readonly name;
    private readonly ops;
    constructor(name?: string);
    add(items: unknown[], timestamp?: number): this;
    remove(items: unknown[], timestamp?: number): this;
    build(): SetPatch;
}
//# sourceMappingURL=set.d.ts.map