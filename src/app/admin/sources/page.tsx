import type { SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { createSource, deleteSource, updateSource } from "@/app/actions/admin";

const SOURCE_TYPES: SourceType[] = ["WEB", "FACEBOOK", "WHATSAPP", "RSS"];

export default async function AdminSourcesPage() {
  await requireAdmin();

  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { rawItems: true, posts: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Fuentes</h1>
        <p className="text-sm text-zinc-500">
          Registry de fuentes del compilador (tipos y flags).
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-zinc-900">Nueva fuente</h2>
        <form action={createSource} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Nombre
            <input
              name="name"
              required
              placeholder="DigitalTacna"
              className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Tipo
            <select
              name="type"
              className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            URL
            <input
              name="url"
              placeholder="https://..."
              className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Intervalo (min) — WEB/RSS
            <input
              name="pollIntervalMinutes"
              type="number"
              className="w-24 rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-zinc-700">
            <input name="autopublish" type="checkbox" className="size-4" />
            autopublish
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Crear
          </button>
        </form>
      </section>

      {sources.length === 0 ? (
        <p className="text-sm text-zinc-400">No hay fuentes registradas.</p>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="rounded-xl border border-zinc-200 bg-white p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-zinc-900">{source.name}</h2>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                  {source.type}
                </span>
              </div>
              <form action={updateSource} className="flex flex-col gap-3">
                <input type="hidden" name="sourceId" value={source.id} />

                <label className="flex flex-col gap-1 text-sm text-zinc-700">
                  Nombre
                  <input
                    name="name"
                    defaultValue={source.name}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                </label>

                <label className="flex flex-col gap-1 text-sm text-zinc-700">
                  URL
                  <input
                    name="url"
                    defaultValue={source.url ?? ""}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                </label>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input
                      name="autopublish"
                      type="checkbox"
                      defaultChecked={source.autopublish}
                      className="size-4"
                    />
                    autopublish
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    Estado
                    <select
                      name="status"
                      defaultValue={source.status}
                      className="rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAUSED">PAUSED</option>
                      <option value="DISABLED">DISABLED</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    Intervalo (min)
                    <input
                      name="pollIntervalMinutes"
                      type="number"
                      defaultValue={source.pollIntervalMinutes ?? ""}
                      className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1 text-sm text-zinc-700">
                  config (JSON opcional)
                  <textarea
                    name="config"
                    rows={3}
                    defaultValue={
                      source.config ? JSON.stringify(source.config, null, 2) : ""
                    }
                    className="rounded border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-500"
                  />
                </label>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-600"
                  >
                    Guardar
                  </button>
                  <form action={deleteSource}>
                    <input type="hidden" name="sourceId" value={source.id} />
                    <button
                      type="submit"
                      className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </form>

              <div className="mt-3 text-xs text-zinc-400">
                {source._count.rawItems} items crudos · {source._count.posts}{" "}
                noticias
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}