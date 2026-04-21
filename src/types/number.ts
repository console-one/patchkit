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
  type OnCommit,
  type TrackConfig,
  type StateCell,
} from "../core.js";

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
export class NumberType extends DataType<number, number, boolean, NumberHandle> {
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

  track(
    cell: StateCell<number>,
    onCommit: OnCommit<number>,
    _configs?: TrackConfig,
  ): NumberHandle {
    const self = this;
    return {
      get value() {
        return cell.get();
      },
      set(n: number) {
        const before = cell.get();
        const patch = n - before;
        if (patch === 0) return;
        cell.set(self.applyPatch(patch, before).state);
        onCommit(patch, -patch);
      },
      add(delta: number) {
        if (delta === 0) return;
        const before = cell.get();
        cell.set(self.applyPatch(delta, before).state);
        onCommit(delta, -delta);
      },
    };
  }
}
