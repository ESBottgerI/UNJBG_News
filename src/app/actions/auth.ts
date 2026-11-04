"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  destroySession,
  setSessionCookie,
} from "@/lib/auth/session";
import { envInt } from "@/lib/config";
import {
  getClientIpFromHeaders,
  rateLimit,
  resetRateLimit,
} from "@/lib/rate-limit";

export type LoginState = { error?: string };

// Login del panel admin. Formulario -> server action -> cookie de sesion.
export async function login(
  _state: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email y contrasena son requeridos." };
  }

  // Anti fuerza bruta (Fase 7): N intentos por IP+email dentro de la ventana.
  // Un login correcto limpia el contador para no castigar al usuario legitimo.
  const ip = getClientIpFromHeaders(await headers());
  const limitKey = `login:${ip}:${email}`;
  const limit = rateLimit({
    key: limitKey,
    limit: envInt("LOGIN_RATE_LIMIT_ATTEMPTS", 5),
    windowMs: envInt("LOGIN_RATE_LIMIT_WINDOW_MIN", 15) * 60_000,
  });
  if (!limit.ok) {
    return {
      error: `Demasiados intentos fallidos. Reintenta en ${limit.retryAfterSeconds} segundos.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Credenciales incorrectas." };
  }

  resetRateLimit(limitKey);
  await setSessionCookie(createSessionToken(user.id));
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}