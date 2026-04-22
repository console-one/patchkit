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
import { OBJECT_COMMAND } from "./types/object.js";
//# sourceMappingURL=paths.js.map