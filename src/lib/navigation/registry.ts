// @uwe A10 / A11 — Espacio y estructura de navegación.
//
// Registro explícito de las clases de navegación de UWE. `proxy.ts` consulta
// este módulo para decidir qué rutas requieren sesión, y la política de acceso
// lo usa para distinguir las rutas solo-ADMIN. Ver
// docs/uwe/03-modelo-navegacion/01-espacio-navegacion.md y
// docs/uwe/03-modelo-navegacion/02-estructura-navegacion.md.
//
// El módulo es puro (sin Prisma ni APIs de Node) para poder importarse desde el
// Proxy de Next.js, que corre en el runtime Edge.

export type NavigationStereotype =
  | "index"
  | "navigation-class"
  | "query"
  | "guided-tour"
  | "process";

export type NavigationAccess = "public" | "authenticated" | "admin" | "api-key";

export type NavigationNode = {
  /** Identificador estable del nodo UWE. */
  id: string;
  /** Ruta o patrón de ruta de Next.js. */
  path: string;
  /** Estereotipo UWE del nodo. */
  stereotype: NavigationStereotype;
  /** Nivel de acceso requerido. */
  access: NavigationAccess;
  /** Etiqueta legible para documentación y menús. */
  label: string;
  /** Nodo padre en la estructura de navegación, si aplica. */
  parentId?: string;
};

export const ADMIN_LOGIN_PATH = "/admin/login";

/** Rutas del panel reservadas al rol ADMIN (el resto basta EDITOR). */
export const ADMIN_ONLY_PATHS = ["/admin/sources", "/admin/categories"] as const;

export const NAVIGATION_NODES: readonly NavigationNode[] = [
  {
    id: "public-home",
    path: "/",
    stereotype: "index",
    access: "public",
    label: "Portada",
  },
  {
    id: "public-section",
    path: "/seccion/:slug",
    stereotype: "navigation-class",
    access: "public",
    label: "Sección",
    parentId: "public-home",
  },
  {
    id: "public-news",
    path: "/noticias/:id",
    stereotype: "navigation-class",
    access: "public",
    label: "Detalle de noticia",
    parentId: "public-home",
  },
  {
    id: "public-search",
    path: "/buscar",
    stereotype: "query",
    access: "public",
    label: "Buscar",
    parentId: "public-home",
  },
  {
    id: "admin-login",
    path: ADMIN_LOGIN_PATH,
    stereotype: "process",
    access: "public",
    label: "Login",
  },
  {
    id: "admin-dashboard",
    path: "/admin",
    stereotype: "index",
    access: "authenticated",
    label: "Dashboard",
    parentId: "admin-login",
  },
  {
    id: "admin-queue",
    path: "/admin/queue",
    stereotype: "query",
    access: "authenticated",
    label: "Cola de revisión",
    parentId: "admin-dashboard",
  },
  {
    id: "admin-queue-item",
    path: "/admin/queue/:id",
    stereotype: "navigation-class",
    access: "authenticated",
    label: "Detalle de item",
    parentId: "admin-queue",
  },
  {
    id: "admin-posts",
    path: "/admin/posts",
    stereotype: "query",
    access: "authenticated",
    label: "Noticias",
    parentId: "admin-dashboard",
  },
  {
    id: "admin-categories",
    path: "/admin/categories",
    stereotype: "index",
    access: "admin",
    label: "Categorías",
    parentId: "admin-dashboard",
  },
  {
    id: "admin-sources",
    path: "/admin/sources",
    stereotype: "index",
    access: "admin",
    label: "Fuentes",
    parentId: "admin-dashboard",
  },
  {
    id: "admin-moderation-tour",
    path: "/admin/queue",
    stereotype: "guided-tour",
    access: "authenticated",
    label: "Flujo de moderación",
    parentId: "admin-queue",
  },
];

/**
 * Guard ligero del Proxy: toda ruta `/admin/*` salvo el login requiere cookie
 * de sesión. La verificación de firma y rol ocurre después, en el servidor.
 */
export function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") &&
    !pathname.startsWith(ADMIN_LOGIN_PATH)
  );
}

/** Rutas que además de sesión exigen rol ADMIN. */
export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/** Nodos públicos, útil para menús y pruebas de navegación. */
export function publicNavigationNodes(): readonly NavigationNode[] {
  return NAVIGATION_NODES.filter((node) => node.access === "public");
}

/**
 * Busca el nodo que corresponde a una ruta concreta. Los patrones con `:param`
 * se comparan por segmentos.
 */
export function findNavigationNode(
  pathname: string
): NavigationNode | undefined {
  return NAVIGATION_NODES.find((node) => matchesPath(node.path, pathname));
}

function matchesPath(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true;
  if (!pattern.includes(":")) return false;

  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every(
    (part, index) => part.startsWith(":") || part === pathParts[index]
  );
}
