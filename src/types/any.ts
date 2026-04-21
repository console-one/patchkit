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
 * Polymorphic dispatcher. Given a Typeset, AnyType recognizes an unknown
 * state/patch/query by asking each registered type in turn, then delegates.
 *
 * This is a clean rewrite of the original `anytype.ts` — the original pulled
 * in proxy-based config threading, an IndexMap of listeners, and a broken
 * `collectErrors` helper. The semantics that actually matter are:
 *   1. recognize an unknown value by probing typeset members
 *   2. delegate apply/diff/collate/query to the matched type
 */
export class AnyType extends DataType<unknown, unknown, unknown> {
  constructor(typeset: Typeset | TypesetAssignment, name = "any") {
    super(name, typeset);
  }

  /** Find the first typeset member (excluding self) whose recognize returns SUCCESS. */
  private dispatch(item: unknown, kind: "state" | "patch" | "query"): DataType | undefined {
    for (const candidate of this.typeset.types()) {
      if (candidate === this) continue;
      const result = candidate.recognize(item);
      if (result[0] === "SUCCESS" && result[1] === kind) return candidate;
    }
    return undefined;
  }

  recognize(item: unknown, _configs?: FormatConfig): RecognizeResult {
    for (const candidate of this.typeset.types()) {
      if (candidate === this) continue;
      const result = candidate.recognize(item);
      if (result[0] === "SUCCESS") return result;
    }
    return ["ERROR", ["No registered type recognized the item"]];
  }

  isState(item: unknown, _configs?: FormatConfig): boolean {
    return this.dispatch(item, "state") !== undefined;
  }

  isPatch(item: unknown, _configs?: FormatConfig): boolean {
    return this.dispatch(item, "patch") !== undefined;
  }

  isQuery(item: unknown, _configs?: FormatConfig): boolean {
    return this.dispatch(item, "query") !== undefined;
  }

  applyPatch(patch: unknown, state: unknown, configs?: PatchConfig): { state: unknown } {
    const t = this.dispatch(patch, "patch") ?? this.dispatch(state, "state");
    if (t === undefined) {
      throw new Error("AnyType.applyPatch: no registered type matched patch or state");
    }
    return t.applyPatch(patch, state, configs);
  }

  diff(before: unknown, after: unknown, configs?: DiffConfig): unknown {
    const t = this.dispatch(before, "state") ?? this.dispatch(after, "state");
    if (t === undefined) {
      throw new Error("AnyType.diff: no registered type matched either state");
    }
    return t.diff(before, after, configs);
  }

  collate(patches: unknown[], configs?: CollateConfig): unknown {
    if (patches.length === 0) {
      throw new Error("AnyType.collate: cannot collate an empty patch array");
    }
    const t = this.dispatch(patches[0], "patch");
    if (t === undefined) {
      throw new Error("AnyType.collate: first patch not recognized by any type");
    }
    return t.collate(patches, configs);
  }

  query(state: unknown, query: unknown, configs?: QueryConfig): unknown {
    const t = this.dispatch(state, "state");
    if (t === undefined) {
      throw new Error("AnyType.query: state not recognized by any type");
    }
    return t.query(state, query, configs);
  }

  convertState(item: unknown, configs?: ConvertConfig): unknown {
    const t = this.dispatch(item, "state");
    return t !== undefined ? t.convertState(item, configs) : item;
  }

  convertPatch(item: unknown, configs?: ConvertConfig): unknown {
    const t = this.dispatch(item, "patch");
    return t !== undefined ? t.convertPatch(item, configs) : item;
  }

  convertQuery(item: unknown, configs?: ConvertConfig): unknown {
    const t = this.dispatch(item, "query");
    return t !== undefined ? t.convertQuery(item, configs) : item;
  }

  /** AnyType has no meaningful nonce — callers should use a specific type. */
  noncePatch(_configs?: FormatConfig): unknown {
    return undefined;
  }

  nonceState(_configs?: FormatConfig): unknown {
    return undefined;
  }

  fullQuery(_configs?: FormatConfig): unknown {
    return undefined;
  }

  /**
   * Delegate to whichever registered type recognizes the current state.
   * The cell's state is re-probed on construction, so the first recognized
   * member wins. Subsequent calls read/write through the delegated tracker.
   */
  track(
    cell: StateCell<unknown>,
    onCommit: OnCommit<unknown>,
    configs?: TrackConfig,
  ): unknown {
    const t = this.dispatch(cell.get(), "state");
    if (t === undefined) {
      throw new Error("AnyType.track: state not recognized by any registered type");
    }
    return (t.track as (
      c: StateCell<unknown>,
      cb: OnCommit<unknown>,
      cfg?: TrackConfig,
    ) => unknown)(cell, onCommit, configs);
  }
}
