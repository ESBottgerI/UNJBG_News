import { describe, expect, it } from "vitest";
import {
  assertCanManageSources,
  canAccessAdminPath,
  canManageSources,
  canModerate,
  requiredRoleForAdminPath,
} from "@/lib/auth/policy";

describe("canModerate", () => {
  it("acepta EDITOR y ADMIN", () => {
    expect(canModerate({ role: "EDITOR" })).toBe(true);
    expect(canModerate({ role: "ADMIN" })).toBe(true);
  });

  it("rechaza actores nulos", () => {
    expect(canModerate(null)).toBe(false);
    expect(canModerate(undefined)).toBe(false);
  });
});

describe("canManageSources", () => {
  it("solo acepta ADMIN", () => {
    expect(canManageSources({ role: "ADMIN" })).toBe(true);
    expect(canManageSources({ role: "EDITOR" })).toBe(false);
  });
});

describe("assertCanManageSources", () => {
  it("lanza el error historico para EDITOR", () => {
    expect(() => assertCanManageSources({ role: "EDITOR" })).toThrow(
      /No autorizado: se requiere rol ADMIN/
    );
  });

  it("no lanza para ADMIN", () => {
    expect(() => assertCanManageSources({ role: "ADMIN" })).not.toThrow();
  });
});

describe("canAccessAdminPath", () => {
  it("un EDITOR entra a moderacion pero no a fuentes", () => {
    expect(canAccessAdminPath({ role: "EDITOR" }, "/admin/queue")).toBe(true);
    expect(canAccessAdminPath({ role: "EDITOR" }, "/admin/posts")).toBe(true);
    expect(canAccessAdminPath({ role: "EDITOR" }, "/admin/sources")).toBe(
      false
    );
  });

  it("un ADMIN entra a todo", () => {
    expect(canAccessAdminPath({ role: "ADMIN" }, "/admin/sources")).toBe(true);
    expect(canAccessAdminPath({ role: "ADMIN" }, "/admin/categories")).toBe(
      true
    );
  });

  it("sin sesion no entra a nada", () => {
    expect(canAccessAdminPath(null, "/admin")).toBe(false);
  });
});

describe("requiredRoleForAdminPath", () => {
  it("distingue rutas solo-ADMIN", () => {
    expect(requiredRoleForAdminPath("/admin/sources")).toBe("ADMIN");
    expect(requiredRoleForAdminPath("/admin/queue")).toBe("EDITOR");
  });
});
