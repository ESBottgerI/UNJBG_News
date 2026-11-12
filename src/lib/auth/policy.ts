import type { User, UserRole } from "@prisma/client";
import { isAdminOnlyPath } from "@/lib/navigation/registry";

// @uwe A12 / ADP-N1..N3 — Política de autorización por rol.
//
// `proxy.ts` solo comprueba que exista la cookie; la decisión real de acceso se
// toma aquí y en `requireUser`/`requireAdmin`. Ver
// docs/uwe/03-modelo-navegacion/03-control-acceso.md.

export type Actor = Pick<User, "role">;

const ADMIN_ONLY_MESSAGE = "No autorizado: se requiere rol ADMIN";

/** Un actor autenticado (EDITOR o ADMIN) puede moderar la cola. */
export function canModerate(actor: Actor | null | undefined): actor is Actor {
  return actor?.role === "ADMIN" || actor?.role === "EDITOR";
}

/** Solo ADMIN puede gestionar fuentes, categorías y usuarios. */
export function canManageSources(actor: Actor | null | undefined): boolean {
  return actor?.role === "ADMIN";
}

/** Lanza el mismo error que usaba `requireAdmin` antes del refactor. */
export function assertCanManageSources(actor: Actor): void {
  if (!canManageSources(actor)) {
    throw new Error(ADMIN_ONLY_MESSAGE);
  }
}

/** Resuelve el rol mínimo necesario para una ruta del panel. */
export function requiredRoleForAdminPath(
  pathname: string
): UserRole | null {
  return isAdminOnlyPath(pathname) ? "ADMIN" : "EDITOR";
}

/** Verifica si un actor puede entrar a una ruta administrativa concreta. */
export function canAccessAdminPath(
  actor: Actor | null | undefined,
  pathname: string
): boolean {
  if (!canModerate(actor)) return false;
  if (!isAdminOnlyPath(pathname)) return true;
  return canManageSources(actor);
}
