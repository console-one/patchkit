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
import { CaptureGroup, CaptureGroupSet } from "../capture.js";

export const OBJECT_COMMAND = {
  SET: "SET",
  DELETE: "DELETE",
  CUT: "CUT",
  COPY: "COPY",
  PATCH: "PATCH",
} as const;

export type ObjectCommandKind = (typeof OBJECT_COMMAND)[keyof typeof OBJECT_COMMAND];

export const COLLATE_STRATEGY = {
  OVERRIDE: "OVERRIDE",
  UNDERRIDE: "UNDERRIDE",
} as const;

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

function isCaptureString(value: unknown): value is string {
  return CaptureGroup.describesJSON(value);
}

function resolveStrategy(configs?: CollateConfig | CollateStrategy): CollateStrategy {
  if (configs === COLLATE_STRATEGY.OVERRIDE || configs === COLLATE_STRATEGY.UNDERRIDE) {
    return configs;
  }
  if (configs && typeof configs === "object") {
    const s = (configs as ObjectCollateConfig).strategy;
    if (s === COLLATE_STRATEGY.OVERRIDE || s === COLLATE_STRATEGY.UNDERRIDE) {
      return s;
    }
  }
  return COLLATE_STRATEGY.OVERRIDE;
}

function isCommand(value: unknown): value is ObjectCommand {
  if (typeof value !== "object" || value === null) return false;
  const cmd = (value as { command?: unknown }).command;
  return (
    cmd === OBJECT_COMMAND.SET ||
    cmd === OBJECT_COMMAND.DELETE ||
    cmd === OBJECT_COMMAND.CUT ||
    cmd === OBJECT_COMMAND.COPY ||
    cmd === OBJECT_COMMAND.PATCH
  );
}

function isNestedPatch(value: unknown, typeName: string): value is ObjectPatch {
  if (typeof value !== "object" || value === null) return false;
  return (value as { __type?: unknown }).__type === `${typeName}:patch`;
}

function resolveCaptureValue(value: unknown, captureGroups: CaptureGroupSet): unknown {
  if (!isCaptureString(value)) return value;
  const cg = CaptureGroup.fromJSON(value);
  if (cg === undefined) return value;
  if (!captureGroups.has(cg)) {
    throw new Error(`CaptureGroup '${cg.id}' referenced before bound`);
  }
  return captureGroups.get(cg);
}

export class ObjectType extends DataType<ObjectState, ObjectPatch, ObjectQuery> {
  patchLimit = 10;

  constructor(typeset: Typeset | TypesetAssignment, name = "object") {
    super(name, typeset);
  }

  recognize(item: unknown, _configs?: FormatConfig): RecognizeResult {
    if (item === undefined || item === null) return ["ERROR", ["No item"]];
    if (typeof item !== "object") return ["ERROR", ["Not an object"]];
    const tag = (item as { __type?: unknown }).__type;
    if (tag === `${this.name}:patch`) return ["SUCCESS", "patch"];
    if (tag === `${this.name}:state`) return ["SUCCESS", "state"];
    if (tag === `${this.name}:query`) return ["SUCCESS", "query"];
    return ["SUCCESS", "state"];
  }

  isState(item: unknown, _configs?: FormatConfig): boolean {
    if (typeof item !== "object" || item === null) return false;
    const tag = (item as { __type?: unknown }).__type;
    return tag === undefined || tag === `${this.name}:state`;
  }

  isPatch(item: unknown, _configs?: FormatConfig): boolean {
    if (typeof item !== "object" || item === null) return false;
    return (item as { __type?: unknown }).__type === `${this.name}:patch`;
  }

  isQuery(item: unknown, _configs?: FormatConfig): boolean {
    if (typeof item !== "object" || item === null) return false;
    return (item as { __type?: unknown }).__type === `${this.name}:query`;
  }

  convertState(item: unknown, _configs?: ConvertConfig): ObjectState {
    if (typeof item === "string") {
      try {
        const parsed = JSON.parse(item);
        if (typeof parsed === "object" && parsed !== null) return parsed as ObjectState;
      } catch {
        // fall through
      }
    }
    if (typeof item === "object" && item !== null) return item as ObjectState;
    return this.nonceState();
  }

  convertPatch(item: unknown, _configs?: ConvertConfig): ObjectPatch {
    if (typeof item === "string") {
      try {
        return JSON.parse(item) as ObjectPatch;
      } catch {
        // fall through
      }
    }
    if (typeof item === "object" && item !== null) return item as ObjectPatch;
    return this.noncePatch();
  }

  convertQuery(item: unknown, _configs?: ConvertConfig): ObjectQuery {
    if (typeof item === "object" && item !== null) return item as ObjectQuery;
    return this.fullQuery();
  }

  nonceState(_configs?: FormatConfig): ObjectState {
    return { __type: `${this.name}:state` };
  }

  noncePatch(_configs?: FormatConfig): ObjectPatch {
    return { __type: `${this.name}:patch` };
  }

  fullQuery(_configs?: FormatConfig): ObjectQuery {
    return { __type: `${this.name}:query` };
  }

  /**
   * Rewrite of the original ObjectType.applyPatch. No proxies, no subscription
   * side effects. Context (captureGroups) is passed explicitly.
   */
  applyPatch(
    patch: ObjectPatch,
    state: ObjectState,
    configs?: PatchConfig
  ): { state: ObjectState } {
    const ctx = this.contextFrom(configs);
    const next: ObjectState = { ...state };
    if (state.__type === undefined) next.__type = `${this.name}:state`;

    // Pass 1: CUT and COPY to populate capture groups.
    for (const key of Object.keys(patch)) {
      if (key === "__type") continue;
      const entry = patch[key];
      if (!isCommand(entry)) continue;
      if (entry.command === OBJECT_COMMAND.CUT) {
        const cg = CaptureGroup.fromJSON(entry.value);
        if (cg === undefined) throw new Error(`CUT value must be a CaptureGroup string`);
        ctx.captureGroups.set(cg, state[key]);
        delete next[key];
      } else if (entry.command === OBJECT_COMMAND.COPY) {
        const cg = CaptureGroup.fromJSON(entry.value);
        if (cg === undefined) throw new Error(`COPY value must be a CaptureGroup string`);
        ctx.captureGroups.set(cg, state[key]);
      }
    }

    // Pass 2: SET, DELETE, PATCH, and nested object-patches.
    for (const key of Object.keys(patch)) {
      if (key === "__type") continue;
      const entry = patch[key];

      if (isCommand(entry)) {
        if (entry.command === OBJECT_COMMAND.CUT || entry.command === OBJECT_COMMAND.COPY) {
          continue;
        }
        if (entry.command === OBJECT_COMMAND.SET) {
          next[key] = resolveCaptureValue(entry.value, ctx.captureGroups);
          continue;
        }
        if (entry.command === OBJECT_COMMAND.DELETE) {
          delete next[key];
          continue;
        }
        if (entry.command === OBJECT_COMMAND.PATCH) {
          const currentValue = state[key];
          const sub = entry.value;
          if (isNestedPatch(sub, this.name)) {
            const nestedResult = this.applyPatch(
              sub,
              (currentValue as ObjectState) ?? this.nonceState(),
              configs
            );
            next[key] = nestedResult.state;
          } else {
            next[key] = sub;
          }
          continue;
        }
      }

      if (isNestedPatch(entry, this.name)) {
        const currentValue = (state[key] as ObjectState) ?? this.nonceState();
        const nestedResult = this.applyPatch(entry, currentValue, configs);
        next[key] = nestedResult.state;
      }
    }

    return { state: next };
  }

  diff(before: ObjectState, after: ObjectState, _configs?: DiffConfig): ObjectPatch {
    const patch: ObjectPatch = { __type: `${this.name}:patch` };
    const keys = new Set<string>();
    for (const k of Object.keys(before)) if (k !== "__type") keys.add(k);
    for (const k of Object.keys(after)) if (k !== "__type") keys.add(k);

    for (const key of keys) {
      const a = before[key];
      const b = after[key];
      const inA = key in before;
      const inB = key in after;

      if (inA && !inB) {
        patch[key] = { command: OBJECT_COMMAND.DELETE };
        continue;
      }
      if (!inA && inB) {
        patch[key] = { command: OBJECT_COMMAND.SET, value: b };
        continue;
      }
      if (this.isState(a) && this.isState(b)) {
        const sub = this.diff(a as ObjectState, b as ObjectState);
        if (Object.keys(sub).filter((k) => k !== "__type").length > 0) {
          patch[key] = sub;
        }
        continue;
      }
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        patch[key] = { command: OBJECT_COMMAND.SET, value: b };
      }
    }
    return patch;
  }

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
  collate(
    patches: ObjectPatch[],
    configs?: CollateConfig | CollateStrategy,
  ): ObjectPatch {
    const strategy = resolveStrategy(configs);
    const result: ObjectPatch = { __type: `${this.name}:patch` };
    for (const p of patches) {
      for (const key of Object.keys(p)) {
        if (key === "__type") continue;
        const incoming = p[key];
        const existing = result[key];
        if (existing === undefined) {
          result[key] = incoming;
          continue;
        }
        if (isNestedPatch(existing, this.name) && isNestedPatch(incoming, this.name)) {
          result[key] = this.collate([existing, incoming], strategy);
          continue;
        }
        if (strategy === COLLATE_STRATEGY.UNDERRIDE) {
          continue;
        }
        result[key] = incoming;
      }
    }
    return result;
  }

  query(state: ObjectState, query: ObjectQuery, _configs?: QueryConfig): unknown {
    if (query.keys && Array.isArray(query.keys)) {
      const out: Record<string, unknown> = {};
      for (const k of query.keys) {
        if (k in state) out[k] = state[k];
      }
      return out;
    }
    return state;
  }

  private contextFrom(configs?: PatchConfig): ObjectPatchContext {
    if (configs && typeof configs === "object" && "captureGroups" in configs) {
      const cg = (configs as { captureGroups?: unknown }).captureGroups;
      if (cg instanceof CaptureGroupSet) {
        return { captureGroups: cg };
      }
    }
    return { captureGroups: new CaptureGroupSet() };
  }

  /**
   * Returns a recursively-tracked Proxy over the cell's state. Property sets
   * or deletes — at any nesting depth that is itself an ObjectState — are
   * captured as properly-nested ObjectPatches (and inverses) and reported to
   * `onCommit` after the cell is updated. Inner proxies resolve through a
   * path re-read on each access, so parent reassignments don't strand them.
   */
  track(
    cell: StateCell<ObjectState>,
    onCommit: OnCommit<ObjectPatch>,
    _configs?: TrackConfig,
  ): ObjectState {
    const self = this;
    const typeTag = `${this.name}:patch`;

    const wrapPatch = (path: string[], leaf: unknown): ObjectPatch => {
      if (path.length === 0) {
        throw new Error("ObjectType.track: cannot wrap a root-level patch");
      }
      const last = path[path.length - 1]!;
      let node: Record<string, unknown> = { __type: typeTag, [last]: leaf };
      for (let i = path.length - 2; i >= 0; i--) {
        const seg = path[i]!;
        node = { __type: typeTag, [seg]: node };
      }
      return node as ObjectPatch;
    };

    const readAt = (path: string[]): ObjectState => {
      let node: unknown = cell.get();
      for (const seg of path) {
        node = (node as Record<string, unknown>)[seg];
      }
      return node as ObjectState;
    };

    const commitSetAtPath = (path: string[], key: string, value: unknown): void => {
      const parent = readAt(path);
      const had = key in parent;
      const prior = (parent as Record<string, unknown>)[key];

      const setLeaf = { command: OBJECT_COMMAND.SET, value };
      const inverseLeaf = had
        ? { command: OBJECT_COMMAND.SET, value: prior }
        : { command: OBJECT_COMMAND.DELETE };

      const patch = wrapPatch([...path, key], setLeaf);
      const inverse = wrapPatch([...path, key], inverseLeaf);

      cell.set(self.applyPatch(patch, cell.get()).state);
      onCommit(patch, inverse);
    };

    const commitDeleteAtPath = (path: string[], key: string): void => {
      const parent = readAt(path);
      if (!(key in parent)) return;
      const prior = (parent as Record<string, unknown>)[key];

      const patch = wrapPatch([...path, key], { command: OBJECT_COMMAND.DELETE });
      const inverse = wrapPatch([...path, key], { command: OBJECT_COMMAND.SET, value: prior });

      cell.set(self.applyPatch(patch, cell.get()).state);
      onCommit(patch, inverse);
    };

    const proxyAt = (path: string[]): ObjectState => {
      return new Proxy({} as ObjectState, {
        get(_target, key) {
          if (typeof key !== "string") {
            return (readAt(path) as Record<string | symbol, unknown>)[key as symbol];
          }
          const v = (readAt(path) as Record<string, unknown>)[key];
          if (self.isState(v)) {
            return proxyAt([...path, key]);
          }
          return v;
        },
        set(_target, key, value) {
          if (typeof key !== "string") return false;
          commitSetAtPath(path, key, value);
          return true;
        },
        deleteProperty(_target, key) {
          if (typeof key !== "string") return true;
          commitDeleteAtPath(path, key);
          return true;
        },
        has(_target, key) {
          return key in (readAt(path) as object);
        },
        ownKeys() {
          return Reflect.ownKeys(readAt(path) as object);
        },
        getOwnPropertyDescriptor(_target, key) {
          return Reflect.getOwnPropertyDescriptor(readAt(path) as object, key);
        },
      }) as ObjectState;
    };

    return proxyAt([]);
  }
}

export class ObjectMutator {
  private readonly ops: Record<string, unknown> = {};
  constructor(private readonly typeName: string = "object") {}

  set(key: string, value: unknown): this {
    this.ops[key] = { command: OBJECT_COMMAND.SET, value };
    return this;
  }

  delete(key: string): this {
    this.ops[key] = { command: OBJECT_COMMAND.DELETE };
    return this;
  }

  cut(key: string, capture: CaptureGroup): this {
    this.ops[key] = { command: OBJECT_COMMAND.CUT, value: capture.toJSON() };
    return this;
  }

  copy(key: string, capture: CaptureGroup): this {
    this.ops[key] = { command: OBJECT_COMMAND.COPY, value: capture.toJSON() };
    return this;
  }

  patch(key: string, inner: (mutator: ObjectMutator) => void): this {
    const m = new ObjectMutator(this.typeName);
    inner(m);
    this.ops[key] = m.build();
    return this;
  }

  build(): ObjectPatch {
    return { __type: `${this.typeName}:patch`, ...this.ops };
  }
}
