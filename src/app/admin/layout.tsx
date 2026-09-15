import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { logout } from "@/app/actions/auth";

// Shell del panel admin. La proteccion real esta en proxy.ts (redireccion si
// falta la cookie) y en cada Server Action/page con requireUser(). Aca no se
// redirige para no entrar en bucle con /admin/login.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <aside className="flex w-56 shrink-0 flex-col bg-zinc-900 p-4 text-white">
        <div className="text-lg font-bold">UNJBG News</div>
        <div className="mb-4 text-xs text-zinc-400">Panel de moderacion</div>

        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/admin"
            className="rounded px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/queue"
            className="rounded px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Cola de revision
          </Link>
          <Link
            href="/admin/posts"
            className="rounded px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Noticias
          </Link>
          <Link
            href="/admin/categories"
            className="rounded px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Categorias
          </Link>
          <Link
            href="/admin/sources"
            className="rounded px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Fuentes
          </Link>
        </nav>

        <div className="mt-auto flex flex-col gap-2 border-t border-zinc-800 pt-4 text-xs">
          <div className="text-zinc-400">
            <span className="font-medium text-zinc-200">
              {user?.name ?? user?.email ?? "Sin sesion"}
            </span>
            {user ? <div>Rol: {user.role}</div> : null}
          </div>
          {user ? (
            <form action={logout}>
              <button
                type="submit"
                className="w-full rounded bg-zinc-800 px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              >
                Cerrar sesion
              </button>
            </form>
          ) : null}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}