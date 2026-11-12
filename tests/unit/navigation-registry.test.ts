import { describe, expect, it } from "vitest";
import {
  ADMIN_LOGIN_PATH,
  findNavigationNode,
  isAdminOnlyPath,
  isProtectedPath,
  publicNavigationNodes,
} from "@/lib/navigation/registry";

describe("isProtectedPath", () => {
  it("protege todo /admin salvo el login", () => {
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/admin/queue")).toBe(true);
    expect(isProtectedPath("/admin/queue/abc")).toBe(true);
    expect(isProtectedPath(ADMIN_LOGIN_PATH)).toBe(false);
  });

  it("no protege rutas publicas", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/noticias/1")).toBe(false);
  });
});

describe("isAdminOnlyPath", () => {
  it("marca fuentes y categorias", () => {
    expect(isAdminOnlyPath("/admin/sources")).toBe(true);
    expect(isAdminOnlyPath("/admin/sources/abc")).toBe(true);
    expect(isAdminOnlyPath("/admin/categories")).toBe(true);
    expect(isAdminOnlyPath("/admin/categories/abc")).toBe(true);
  });

  it("no marca rutas de moderacion", () => {
    expect(isAdminOnlyPath("/admin/queue")).toBe(false);
    expect(isAdminOnlyPath("/admin/posts")).toBe(false);
  });
});

describe("findNavigationNode", () => {
  it("resuelve rutas exactas", () => {
    expect(findNavigationNode("/")?.id).toBe("public-home");
    expect(findNavigationNode("/admin/queue")?.id).toBe("admin-queue");
  });

  it("resuelve rutas con parametros", () => {
    expect(findNavigationNode("/noticias/abc")?.id).toBe("public-news");
    expect(findNavigationNode("/seccion/local")?.id).toBe("public-section");
  });

  it("devuelve undefined para rutas desconocidas", () => {
    expect(findNavigationNode("/no-existe")).toBeUndefined();
  });
});

describe("publicNavigationNodes", () => {
  it("solo devuelve nodos publicos", () => {
    const nodes = publicNavigationNodes();
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((node) => node.access === "public")).toBe(true);
  });
});
