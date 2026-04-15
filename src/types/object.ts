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
import { CaptureGroup, CaptureGroupSet } from "../capture.js";

export const OBJECT_COMMAND = {
  SET: "SET",
  DELETE: "DELETE",
  CUT: "CUT",
  COPY: "COPY",
  PATCH: "PATCH",
} as const;

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

function isCaptureString(value: unknown): value is string {
  return CaptureGroup.describesJSON(value);
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

  collate(patches: ObjectPatch[], _configs?: CollateConfig): ObjectPatch {
    const result: ObjectPatch = { __type: `${this.name}:patch` };
    for (const p of patches) {
      for (const key of Object.keys(p)) {
        if (key === "__type") continue;
        const incoming = p[key];
        const existing = result[key];
        if (isNestedPatch(existing, this.name) && isNestedPatch(incoming, this.name)) {
          result[key] = this.collate([existing, incoming]);
        } else {
          result[key] = incoming;
        }
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
