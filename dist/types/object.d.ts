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
export declare const COLLATE_STRATEGY: {
    readonly OVERRIDE: "OVERRIDE";
    readonly UNDERRIDE: "UNDERRIDE";
};
export type CollateStrategy = (typeof COLLATE_STRATEGY)[keyof typeof COLLATE_STRATEGY];
export interface ObjectCollateConfig extends CollateConfig {
    strategy?: CollateStrategy;
}
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
    /**
     * Fuse patches into one. Two strategies are supported:
     *
     *   - `OVERRIDE` (default): later patches override earlier ones at the same key.
     *     This is the intuitive "apply in order, last write wins" semantic.
     *   - `UNDERRIDE`: earlier patches win; later patches only fill in keys the
     *     earlier patch doesn't mention. Useful for applying defaults or
     *     merging partial patches onto an in-progress patch without clobbering.
     *
     * In both strategies, when existing and incoming are BOTH nested ObjectPatches
     * at the same key, collate recurses into them (same strategy propagates).
     *
     * The config argument can be a strategy string directly (`"UNDERRIDE"`) or a
     * config object with `{ strategy }`.
     */
    collate(patches: ObjectPatch[], configs?: CollateConfig | CollateStrategy): ObjectPatch;
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