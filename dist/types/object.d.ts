import { DataType, type Typeset, type TypesetAssignment, type FormatConfig, type ConvertConfig, type PatchConfig, type DiffConfig, type CollateConfig, type QueryConfig, type RecognizeResult } from "../core.js";
import { CaptureGroup, CaptureGroupSet } from "../capture.js";
export declare const OBJECT_COMMAND: {
    readonly SET: "SET";
    readonly DELETE: "DELETE";
    readonly CUT: "CUT";
    readonly COPY: "COPY";
    readonly PATCH: "PATCH";
};
export type ObjectCommandKind = (typeof OBJECT_COMMAND)[keyof typeof OBJECT_COMMAND];
export interface ObjectCommand {
    command: ObjectCommandKind;
    value?: unknown;
}
export interface ObjectPatch {
    __type: string;
    [key: string]: unknown;
}
export interface ObjectState {
    __type?: string;
    [key: string]: unknown;
}
export interface ObjectQuery {
    __type: string;
    keys?: string[];
}
/** Context for a single applyPatch call. Explicit instead of proxy threading. */
export interface ObjectPatchContext {
    captureGroups: CaptureGroupSet;
}
export declare class ObjectType extends DataType<ObjectState, ObjectPatch, ObjectQuery> {
    patchLimit: number;
    constructor(typeset: Typeset | TypesetAssignment, name?: string);
    recognize(item: unknown, _configs?: FormatConfig): RecognizeResult;
    isState(item: unknown, _configs?: FormatConfig): boolean;
    isPatch(item: unknown, _configs?: FormatConfig): boolean;
    isQuery(item: unknown, _configs?: FormatConfig): boolean;
    convertState(item: unknown, _configs?: ConvertConfig): ObjectState;
    convertPatch(item: unknown, _configs?: ConvertConfig): ObjectPatch;
    convertQuery(item: unknown, _configs?: ConvertConfig): ObjectQuery;
    nonceState(_configs?: FormatConfig): ObjectState;
    noncePatch(_configs?: FormatConfig): ObjectPatch;
    fullQuery(_configs?: FormatConfig): ObjectQuery;
    /**
     * Rewrite of the original ObjectType.applyPatch. No proxies, no subscription
     * side effects. Context (captureGroups) is passed explicitly.
     */
    applyPatch(patch: ObjectPatch, state: ObjectState, configs?: PatchConfig): {
        state: ObjectState;
    };
    diff(before: ObjectState, after: ObjectState, _configs?: DiffConfig): ObjectPatch;
    collate(patches: ObjectPatch[], _configs?: CollateConfig): ObjectPatch;
    query(state: ObjectState, query: ObjectQuery, _configs?: QueryConfig): unknown;
    private contextFrom;
}
export declare class ObjectMutator {
    private readonly typeName;
    private readonly ops;
    constructor(typeName?: string);
    set(key: string, value: unknown): this;
    delete(key: string): this;
    cut(key: string, capture: CaptureGroup): this;
    copy(key: string, capture: CaptureGroup): this;
    patch(key: string, inner: (mutator: ObjectMutator) => void): this;
    build(): ObjectPatch;
}
//# sourceMappingURL=object.d.ts.map