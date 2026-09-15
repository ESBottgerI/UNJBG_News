import { getSessionUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

// Login del panel de moderacion. Accesible sin sesion.
export default async function AdminLoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
        <h1 className="mb-1 text-xl font-bold text-zinc-900">UNJBG News</h1>
        <p className="mb-6 text-sm text-zinc-500">Panel de moderacion</p>

        <LoginForm />

        <p className="mt-4 text-center text-xs text-zinc-400">
          Usuarios y permisos: ver seed / panel de admin.
        </p>
      </div>
    </main>
  );
}