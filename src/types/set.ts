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

export const SET_OP = {
  ADD: "add",
  REMOVE: "remove",
} as const;

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

export class SetType extends DataType<SetState, SetPatch, SetQuery> {
  patchLimit = 5;

  constructor(typeset: Typeset | TypesetAssignment, name = "set") {
    super(name, typeset);
  }

  recognize(item: unknown, _configs?: FormatConfig): RecognizeResult {
    if (item === undefined || item === null) {
      return ["ERROR", ["No item provided to recognize."]];
    }
    if (item instanceof Set) return ["SUCCESS", "state"];
    if (typeof item === "object") {
      const tag = (item as { __type?: unknown }).__type;
      if (tag === `${this.name}:patch`) return ["SUCCESS", "patch"];
      if (tag === `${this.name}:query`) return ["SUCCESS", "query"];
      if (tag === `${this.name}:state`) return ["SUCCESS", "state"];
    }
    return ["ERROR", [`Unrecognized item for type=${this.name}`]];
  }

  isState(item: unknown, _configs?: FormatConfig): boolean {
    return item instanceof Set;
  }

  isPatch(item: unknown, _configs?: FormatConfig): boolean {
    return (
      typeof item === "object" &&
      item !== null &&
      (item as { __type?: unknown }).__type === `${this.name}:patch`
    );
  }

  isQuery(item: unknown, _configs?: FormatConfig): boolean {
    return (
      typeof item === "object" &&
      item !== null &&
      (item as { __type?: unknown }).__type === `${this.name}:query`
    );
  }

  convertState(item: unknown, configs?: ConvertConfig): SetState {
    if (configs?.toFormat === "json") {
      if (item instanceof Set) {
        return JSON.stringify([...item]) as unknown as SetState;
      }
    }
    if (configs?.fromFormat === "json" && typeof item === "string") {
      try {
        const arr = JSON.parse(item);
        if (Array.isArray(arr)) return new Set(arr);
      } catch {
        // fall through
      }
    }
    if (item instanceof Set) return item;
    if (Array.isArray(item)) return new Set(item);
    return new Set();
  }

  convertPatch(item: unknown, configs?: ConvertConfig): SetPatch {
    if (configs?.fromFormat === "json" && typeof item === "string") {
      return JSON.parse(item) as SetPatch;
    }
    if (configs?.toFormat === "json" && typeof item === "object") {
      return JSON.stringify(item) as unknown as SetPatch;
    }
    return item as SetPatch;
  }

  convertQuery(item: unknown, configs?: ConvertConfig): SetQuery {
    if (configs?.fromFormat === "json" && typeof item === "string") {
      return JSON.parse(item) as SetQuery;
    }
    if (configs?.toFormat === "json" && typeof item === "object") {
      return JSON.stringify(item) as unknown as SetQuery;
    }
    return item as SetQuery;
  }

  nonceState(_configs?: FormatConfig): SetState {
    return new Set();
  }

  noncePatch(_configs?: FormatConfig): SetPatch {
    return { __type: `${this.name}:patch`, ops: [] };
  }

  fullQuery(_configs?: FormatConfig): SetQuery {
    return { __type: `${this.name}:query` };
  }

  applyPatch(patch: SetPatch, state: SetState, _configs?: PatchConfig): { state: SetState } {
    const next = new Set(state);
    for (const op of patch.ops) {
      switch (op.kind) {
        case SET_OP.ADD:
          for (const item of op.items) next.add(item);
          break;
        case SET_OP.REMOVE:
          for (const item of op.items) next.delete(item);
          break;
      }
    }
    return { state: next };
  }

  diff(before: SetState, after: SetState, _configs?: DiffConfig): SetPatch {
    const patch: SetPatch = { __type: `${this.name}:patch`, ops: [] };
    const toRemove: unknown[] = [];
    for (const item of before) if (!after.has(item)) toRemove.push(item);
    if (toRemove.length > 0) patch.ops.push({ kind: SET_OP.REMOVE, items: toRemove });
    const toAdd: unknown[] = [];
    for (const item of after) if (!before.has(item)) toAdd.push(item);
    if (toAdd.length > 0) patch.ops.push({ kind: SET_OP.ADD, items: toAdd });
    return patch;
  }

  collate(patches: SetPatch[], _configs?: CollateConfig): SetPatch {
    const netAdd = new Set<unknown>();
    const netRemove = new Set<unknown>();
    for (const p of patches) {
      for (const op of p.ops) {
        if (op.kind === SET_OP.ADD) {
          for (const item of op.items) {
            netRemove.delete(item);
            netAdd.add(item);
          }
        } else if (op.kind === SET_OP.REMOVE) {
          for (const item of op.items) {
            netAdd.delete(item);
            netRemove.add(item);
          }
        }
      }
    }
    const ops: SetOp[] = [];
    if (netAdd.size > 0) ops.push({ kind: SET_OP.ADD, items: [...netAdd] });
    if (netRemove.size > 0) ops.push({ kind: SET_OP.REMOVE, items: [...netRemove] });
    return { __type: `${this.name}:patch`, ops };
  }

  query(state: SetState, query: SetQuery, _configs?: QueryConfig): unknown {
    if (query && "has" in query && query.has !== undefined) {
      return state.has(query.has);
    }
    return [...state];
  }
}

export class SetPatchBuilder {
  private readonly ops: SetOp[] = [];
  constructor(private readonly name: string = "set") {}

  add(items: unknown[], timestamp?: number): this {
    const op: SetOp = { kind: SET_OP.ADD, items };
    if (timestamp !== undefined) op.timestamp = timestamp;
    this.ops.push(op);
    return this;
  }

  remove(items: unknown[], timestamp?: number): this {
    const op: SetOp = { kind: SET_OP.REMOVE, items };
    if (timestamp !== undefined) op.timestamp = timestamp;
    this.ops.push(op);
    return this;
  }

  build(): SetPatch {
    return { __type: `${this.name}:patch`, ops: [...this.ops] };
  }
}
