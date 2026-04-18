import {
  DataType,
  type Typeset,
  type TypesetAssignment,
  type FormatConfig,
  type ConvertConfig,
  type PatchConfig,
  type DiffConfig,
  type CollateConfig,
  type QueryConfig,
  type RecognizeResult,
} from "../core.js";

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
export class NumberType extends DataType<number, number, boolean> {
  constructor(typeset: Typeset | TypesetAssignment, name: string = "number") {
    super(name, typeset);
  }

  applyPatch(patch: number, state: number, _configs?: PatchConfig): { state: number } {
    return { state: state + patch };
  }

  diff(before: number, after: number, _configs?: DiffConfig): number {
    return after - before;
  }

  collate(patches: number[], _configs?: CollateConfig): number {
    return patches.reduce((a, b) => a + b, 0);
  }

  query(state: number, query: boolean, _configs?: QueryConfig): number | undefined {
    return query ? state : undefined;
  }

  recognize(item: unknown, _configs?: FormatConfig): RecognizeResult {
    if (typeof item === "number" && Number.isFinite(item)) {
      return ["SUCCESS", "state"];
    }
    return ["ERROR", ["not a finite number"]];
  }

  isState(item: unknown, _configs?: FormatConfig): boolean {
    return typeof item === "number" && Number.isFinite(item);
  }

  isPatch(item: unknown, _configs?: FormatConfig): boolean {
    return typeof item === "number" && Number.isFinite(item);
  }

  isQuery(item: unknown, _configs?: FormatConfig): boolean {
    return typeof item === "boolean";
  }

  convertState(item: unknown, _configs?: ConvertConfig): number {
    const n = Number(item);
    if (!Number.isFinite(n)) {
      throw new Error(`NumberType: cannot convert ${JSON.stringify(item)} to a finite number`);
    }
    return n;
  }

  convertPatch(item: unknown, _configs?: ConvertConfig): number {
    return this.convertState(item);
  }

  convertQuery(item: unknown, _configs?: ConvertConfig): boolean {
    return Boolean(item);
  }

  noncePatch(_configs?: FormatConfig): number {
    return 0;
  }

  nonceState(_configs?: FormatConfig): number {
    return 0;
  }

  fullQuery(_configs?: FormatConfig): boolean {
    return true;
  }
}
