/**
 * Type-level path helpers for structural patch authoring.
 *
 * These types let consumers describe object-shaped patches with compile-time
 * knowledge of which keys exist and which types live at each path. The
 * runtime patch shape (`ObjectPatch`) stays untyped for flexibility; these
 * types sit on top as an opt-in typed layer.
 *
 *   type State = { user: { name: string; age?: number } };
 *   type P = Paths<State>;                       // "user" | "user.name" | "user.age"
 *   type V = PathValue<State, "user.name">;      // string
 *   type E = PatchEvent<State>;                  // discriminated union per path
 *
 * Use `TypedObjectPatch<T>` as a drop-in typed variant of `ObjectPatch` when
 * the target state shape is known statically.
 */
import { OBJECT_COMMAND, type ObjectPatch } from "./types/object.js";
/** Leaves that should stop path recursion. */
type Primitive = string | number | boolean | bigint | symbol | null | undefined | ((...a: any[]) => any);
/**
 * All legal dot-separated paths inside T. Recursion stops at primitives and
 * at function-typed leaves. Optional properties and arrays participate by
 * their value types (paths into array elements are not currently emitted —
 * use `Array`-shaped patches for element-level mutation).
 */
export type Paths<T, Prev extends string = ""> = {
    [K in keyof T & (string | number)]: T[K] extends Primitive ? `${Prev}${K & string}` : `${Prev}${K & string}` | Paths<T[K], `${Prev}${K & string}.`>;
}[keyof T & (string | number)];
/** Resolve the value type at a given dot-path P inside T. */
export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Tail}` ? Head extends keyof T ? PathValue<T[Head], Tail> : never : P extends keyof T ? T[P] : never;
/**
 * Discriminated union: one arm per reachable path in T. Each arm pairs the
 * path with a typed value operation. Useful for event-stream consumers that
 * want `switch (event.path)` to narrow `event.value` automatically.
 */
export type PatchEvent<T> = {
    [P in Paths<T>]: {
        path: P;
        value: {
            command: typeof OBJECT_COMMAND.SET;
            value: PathValue<T, P>;
        } | {
            command: typeof OBJECT_COMMAND.DELETE;
        } | {
            command: typeof OBJECT_COMMAND.DEFAULT;
            value: PathValue<T, P>;
        };
    };
}[Paths<T>];
/**
 * A structurally-typed variant of {@link ObjectPatch} parameterized by the
 * target state shape T. Recursively narrows nested patches to T's subtrees,
 * while still accepting the untyped ObjectPatch surface as a supertype so
 * existing runtime code keeps working.
 *
 * TypedObjectPatch<T> is assignable to ObjectPatch. Not every ObjectPatch is
 * a valid TypedObjectPatch<T> — the whole point is to reject invalid keys at
 * compile time.
 */
export type TypedObjectPatch<T> = ObjectPatch & {
    [K in keyof T & string]?: {
        command: typeof OBJECT_COMMAND.SET;
        value: T[K];
    } | {
        command: typeof OBJECT_COMMAND.DELETE;
    } | {
        command: typeof OBJECT_COMMAND.DEFAULT;
        value: T[K];
    } | {
        command: typeof OBJECT_COMMAND.CUT;
        value: string;
    } | {
        command: typeof OBJECT_COMMAND.COPY;
        value: string;
    } | (T[K] extends object ? TypedObjectPatch<T[K]> : never);
};
export {};
//# sourceMappingURL=paths.d.ts.map