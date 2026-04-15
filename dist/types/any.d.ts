import { DataType, type Typeset, type TypesetAssignment, type FormatConfig, type ConvertConfig, type PatchConfig, type DiffConfig, type CollateConfig, type QueryConfig, type RecognizeResult } from "../core.js";
/**
 * Polymorphic dispatcher. Given a Typeset, AnyType recognizes an unknown
 * state/patch/query by asking each registered type in turn, then delegates.
 *
 * This is a clean rewrite of the original `anytype.ts` — the original pulled
 * in proxy-based config threading, an IndexMap of listeners, and a broken
 * `collectErrors` helper. The semantics that actually matter are:
 *   1. recognize an unknown value by probing typeset members
 *   2. delegate apply/diff/collate/query to the matched type
 */
export declare class AnyType extends DataType<unknown, unknown, unknown> {
    constructor(typeset: Typeset | TypesetAssignment, name?: string);
    /** Find the first typeset member (excluding self) whose recognize returns SUCCESS. */
    private dispatch;
    recognize(item: unknown, _configs?: FormatConfig): RecognizeResult;
    isState(item: unknown, _configs?: FormatConfig): boolean;
    isPatch(item: unknown, _configs?: FormatConfig): boolean;
    isQuery(item: unknown, _configs?: FormatConfig): boolean;
    applyPatch(patch: unknown, state: unknown, configs?: PatchConfig): {
        state: unknown;
    };
    diff(before: unknown, after: unknown, configs?: DiffConfig): unknown;
    collate(patches: unknown[], configs?: CollateConfig): unknown;
    query(state: unknown, query: unknown, configs?: QueryConfig): unknown;
    convertState(item: unknown, configs?: ConvertConfig): unknown;
    convertPatch(item: unknown, configs?: ConvertConfig): unknown;
    convertQuery(item: unknown, configs?: ConvertConfig): unknown;
    /** AnyType has no meaningful nonce — callers should use a specific type. */
    noncePatch(_configs?: FormatConfig): unknown;
    nonceState(_configs?: FormatConfig): unknown;
    fullQuery(_configs?: FormatConfig): unknown;
}
//# sourceMappingURL=any.d.ts.map