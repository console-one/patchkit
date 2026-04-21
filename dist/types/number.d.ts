import { DataType, type Typeset, type TypesetAssignment, type FormatConfig, type ConvertConfig, type PatchConfig, type DiffConfig, type CollateConfig, type QueryConfig, type RecognizeResult, type OnCommit, type TrackConfig, type StateCell } from "../core.js";
/**
 * Mutable handle surface a {@link NumberType} `track()` call returns. Can't
 * Proxy a primitive directly, so instead we expose `set`/`add`/`value`.
 */
export interface NumberHandle {
    readonly value: number;
    set(n: number): void;
    add(delta: number): void;
}
/**
 * A minimal `DataType` for numeric state where both the patch and the
 * diff are plain deltas. Illustrates the "additive group" version of
 * the contract:
 *
 *   - `applyPatch(delta, state)` returns `state + delta`
 *   - `diff(before, after)` returns `after - before`
 *   - `collate(deltas)` sums them (so composition is associative)
 *   - `noncePatch()` / `nonceState()` are both `0`
 *
 * The `query` projection accepts a boolean: `true` returns the current
 * value, `false` returns `undefined`. `fullQuery()` is `true`.
 *
 * Useful on its own for counters, cursors, offsets, or as a building
 * block inside larger types that embed numeric subfields.
 */
export declare class NumberType extends DataType<number, number, boolean, NumberHandle> {
    constructor(typeset: Typeset | TypesetAssignment, name?: string);
    applyPatch(patch: number, state: number, _configs?: PatchConfig): {
        state: number;
    };
    diff(before: number, after: number, _configs?: DiffConfig): number;
    collate(patches: number[], _configs?: CollateConfig): number;
    query(state: number, query: boolean, _configs?: QueryConfig): number | undefined;
    recognize(item: unknown, _configs?: FormatConfig): RecognizeResult;
    isState(item: unknown, _configs?: FormatConfig): boolean;
    isPatch(item: unknown, _configs?: FormatConfig): boolean;
    isQuery(item: unknown, _configs?: FormatConfig): boolean;
    convertState(item: unknown, _configs?: ConvertConfig): number;
    convertPatch(item: unknown, _configs?: ConvertConfig): number;
    convertQuery(item: unknown, _configs?: ConvertConfig): boolean;
    noncePatch(_configs?: FormatConfig): number;
    nonceState(_configs?: FormatConfig): number;
    fullQuery(_configs?: FormatConfig): boolean;
    track(cell: StateCell<number>, onCommit: OnCommit<number>, _configs?: TrackConfig): NumberHandle;
}
//# sourceMappingURL=number.d.ts.map