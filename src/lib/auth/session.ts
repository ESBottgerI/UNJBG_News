import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

const SESSION_COOKIE = "unjbg_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

type SessionClaim = { uid: string; iat: number };

// Sesion stateless: el claim (base64url JSON) se firma con HMAC-SHA256 usando
// AUTH_SECRET. Se guarda solo en una cookie httpOnly (nunca en el cliente JS).
export function createSessionToken(userId: string): string {
  const claim: SessionClaim = { uid: userId, iat: Date.now() };
  const claimB64 = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${claimB64}.${computeSig(claimB64)}`;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// Devuelve el usuario autenticado (validando firma + vencimiento) o null.
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  const claimB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = computeSig(claimB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let uid: string;
  let iat: number;
  try {
    const parsed = JSON.parse(
      Buffer.from(claimB64, "base64url").toString("utf8")
    ) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { uid: rawUid, iat: rawIat } = parsed as {
      uid: unknown;
      iat: unknown;
    };
    if (typeof rawUid !== "string" || typeof rawIat !== "number") return null;
    uid = rawUid;
    iat = rawIat;
  } catch {
    return null;
  }

  if (Date.now() - iat > MAX_AGE_SECONDS * 1000) return null;

  return prisma.user.findUnique({ where: { id: uid } });
}

// Para Server Actions / paginas del admin: redirige al login si no hay sesion.
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

// Restriccion por rol (solo ADMIN).
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN");
  }
  return user;
}

function computeSig(claimB64: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET no esta configurado");
  }
  return createHmac("sha256", secret).update(claimB64).digest("base64url");
}