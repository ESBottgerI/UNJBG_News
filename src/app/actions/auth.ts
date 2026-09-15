"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  destroySession,
  setSessionCookie,
} from "@/lib/auth/session";

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

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Credenciales incorrectas." };
  }

  await setSessionCookie(createSessionToken(user.id));
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}