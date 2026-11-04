import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { createUser, disconnect, resetDatabase } from "../helpers/db";

const cookieState = vi.hoisted(() => ({
  token: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "unjbg_session" && cookieState.token
        ? { name, value: cookieState.token }
        : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import {
  createSessionToken,
  getSessionUser,
  requireAdmin,
  requireUser,
} from "@/lib/auth/session";
import { redirect } from "next/navigation";

const SECRET = process.env.AUTH_SECRET ?? "secreto-de-test";

function signClaim(claim: { uid: string; iat: number }): string {
  const claimB64 = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(claimB64).digest("base64url");
  return `${claimB64}.${sig}`;
}

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

beforeEach(async () => {
  await resetDatabase();
  cookieState.token = undefined;
  vi.mocked(redirect).mockClear();
});

afterAll(async () => {
  await disconnect();
});

describe("getSessionUser", () => {
  it("devuelve null sin cookie", async () => {
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("devuelve el usuario con un token valido", async () => {
    const user = await createUser({ name: "Admin" });
    cookieState.token = createSessionToken(user.id);

    const found = await getSessionUser();
    expect(found?.id).toBe(user.id);
    expect(found?.email).toBe(user.email);
  });

  it("devuelve null si el usuario del token ya no existe", async () => {
    cookieState.token = createSessionToken("usuario-borrado");
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("rechaza un token con firma manipulada", async () => {
    const user = await createUser();
    const token = createSessionToken(user.id);
    cookieState.token = `${token.slice(0, -2)}xx`;

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("rechaza un claim modificado con la firma original", async () => {
    const user = await createUser();
    const token = createSessionToken(user.id);
    const [, signature] = token.split(".");
    const forgedClaim = Buffer.from(
      JSON.stringify({ uid: "otro-usuario", iat: Date.now() })
    ).toString("base64url");

    cookieState.token = `${forgedClaim}.${signature}`;
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("rechaza un token vencido", async () => {
    const user = await createUser();
    cookieState.token = signClaim({
      uid: user.id,
      iat: Date.now() - 8 * 24 * 60 * 60 * 1000,
    });

    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("acepta un token dentro de la ventana de 7 dias", async () => {
    const user = await createUser();
    cookieState.token = signClaim({
      uid: user.id,
      iat: Date.now() - 6 * 24 * 60 * 60 * 1000,
    });

    await expect(getSessionUser()).resolves.toMatchObject({ id: user.id });
  });

  it("rechaza tokens malformados sin lanzar", async () => {
    for (const token of ["", "sin-punto", ".firma", "claim.", "a.b.c"]) {
      cookieState.token = token;
      await expect(getSessionUser()).resolves.toBeNull();
    }
  });
});

describe("requireUser / requireAdmin", () => {
  it("requireUser redirige al login sin sesion", async () => {
    await expect(requireUser()).rejects.toThrow(/REDIRECT:\/admin\/login/);
    expect(redirect).toHaveBeenCalledWith("/admin/login");
  });

  it("requireUser devuelve el usuario autenticado", async () => {
    const user = await createUser();
    cookieState.token = createSessionToken(user.id);

    await expect(requireUser()).resolves.toMatchObject({ id: user.id });
  });

  it("requireAdmin rechaza a un EDITOR", async () => {
    const editor = await createUser({ role: "EDITOR" });
    cookieState.token = createSessionToken(editor.id);

    await expect(requireAdmin()).rejects.toThrow(/ADMIN/);
  });

  it("requireAdmin acepta a un ADMIN", async () => {
    const admin = await createUser({ role: "ADMIN" });
    cookieState.token = createSessionToken(admin.id);

    await expect(requireAdmin()).resolves.toMatchObject({
      id: admin.id,
      role: "ADMIN",
    });
  });
});
