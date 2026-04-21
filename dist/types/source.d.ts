import { DataType, type Typeset, type TypesetAssignment, type FormatConfig, type ConvertConfig, type PatchConfig, type DiffConfig, type CollateConfig, type QueryConfig, type RecognizeResult, type OnCommit, type TrackConfig, type StateCell } from "../core.js";
/**
 * Mutable handle returned by {@link Source.track}. Text can't be proxied as
 * a primitive, so we expose explicit edit operations (`insert`, `delete`,
 * `replace`). Each call commits a `SourceUpdate` with the minimal change
 * describing the edit and a matching inverse.
 */
export interface SourceHandle {
    readonly text: string;
    insert(at: number, chunk: string): void;
    delete(from: number, to: number): void;
    replace(from: number, to: number, chunk: string): void;
}
export declare const MUTATION: {
    readonly ADDITION: 0;
    readonly DELETION: 1;
};
export type MutationKind = (typeof MUTATION)[keyof typeof MUTATION];
export interface SourceChange {
    index: number;
    change: string;
    type: MutationKind;
    timestamp: number;
    length?: number;
}
export interface SourceText {
    text: string;
}
/**
 * An ordered list of SourceChanges, sorted by (index asc, inputIndex asc).
 * Replaces the `heap-js` dependency from the original with a plain sort.
 */
export declare class SourceUpdate {
    readonly changes: SourceChange[];
    constructor(input?: SourceChange[]);
    toArray(): SourceChange[];
    toJSON(): {
        type: "SourceUpdate";
        value: SourceChange[];
    };
    static fromJSON(data: unknown): SourceUpdate | undefined;
    get length(): number;
}
export interface SourceQuery {
    type: "byIndex" | "byType" | "summarize";
    start?: number;
    end?: number;
    mutationType?: MutationKind;
}
export declare class Source extends DataType<SourceText, SourceUpdate, SourceQuery, SourceHandle> {
    constructor(typeset: Typeset | TypesetAssignment, name?: string);
    applyPatch(patch: SourceUpdate, state: SourceText, _configs?: PatchConfig): {
        state: SourceText;
    };
    diff(before: SourceText, after: SourceText, _configs?: DiffConfig): SourceUpdate;
    collate(patches: SourceUpdate[], _configs?: CollateConfig): SourceUpdate;
    query(state: SourceText, query: SourceQuery, _configs?: QueryConfig): unknown;
    recognize(item: unknown, configs?: FormatConfig): RecognizeResult;
    isState(item: unknown, _configs?: FormatConfig): boolean;
    isPatch(item: unknown, _configs?: FormatConfig): boolean;
    isQuery(item: unknown, _configs?: FormatConfig): boolean;
    convertState(item: unknown, _configs?: ConvertConfig): SourceText;
    convertPatch(item: unknown, _configs?: ConvertConfig): SourceUpdate;
    convertQuery(item: unknown, _configs?: ConvertConfig): SourceQuery;
    noncePatch(_configs?: FormatConfig): SourceUpdate;
    nonceState(_configs?: FormatConfig): SourceText;
    fullQuery(_configs?: FormatConfig): SourceQuery;
    /**
     * Returns a live text handle. Each `insert` / `delete` / `replace` commits
     * a minimal SourceUpdate (one or two SourceChanges) plus its inverse so
     * a coordinator can replay or roll back edits without re-diffing.
     */
    track(cell: StateCell<SourceText>, onCommit: OnCommit<SourceUpdate>, _configs?: TrackConfig): SourceHandle;
}
//# sourceMappingURL=source.d.ts.map