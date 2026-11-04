import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password", () => {
  it("genera un hash con formato scrypt:salt:hash", async () => {
    const hash = await hashPassword("secreto");
    const parts = hash.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[2]).toMatch(/^[0-9a-f]{128}$/);
  });

  it("usa sal distinta en cada hash", async () => {
    const a = await hashPassword("secreto");
    const b = await hashPassword("secreto");
    expect(a).not.toBe(b);
  });

  it("verifica la contrasena correcta e ignora la incorrecta", async () => {
    const hash = await hashPassword("secreto");
    await expect(verifyPassword("secreto", hash)).resolves.toBe(true);
    await expect(verifyPassword("otra", hash)).resolves.toBe(false);
  });

  it("rechaza formatos invalidos sin lanzar", async () => {
    await expect(verifyPassword("x", "")).resolves.toBe(false);
    await expect(verifyPassword("x", "bcrypt:aa:bb")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt::")).resolves.toBe(false);
    await expect(verifyPassword("x", "scrypt:salt")).resolves.toBe(false);
  });
});
