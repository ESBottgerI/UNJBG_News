import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { approveRawItem, discardRawItem } from "@/app/actions/admin";

type PayloadShape = {
  title?: unknown;
  body?: unknown;
  images?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default async function AdminRawItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const item = await prisma.rawItem.findUnique({
    where: { id },
    include: { source: true, post: true },
  });
  if (!item) notFound();

  const payload = (item.payload ?? {}) as PayloadShape;
  const bodyText = asString(payload.body);
  const imageList = Array.isArray(payload.images)
    ? payload.images.filter((i): i is string => typeof i === "string")
    : [];
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <Link
          href="/admin/queue"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Volver a la cola
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">
          {item.title ?? "(sin titulo)"}
        </h1>
        <p className="text-sm text-zinc-500">
          Fuente: {item.source.name} ({item.source.type}) · Llego:{" "}
          {formatDate(item.seenAt)} · Estado: {item.status}
        </p>
      </header>

      {item.status === "DISCARDED" ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          Este item fue <strong>descartado</strong> {formatDate(item.processedAt)}
          . No se puede aprobar; se puede re-ingresar desde la fuente si es necesario.
        </div>
      ) : null}

      {item.post ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Ya convertido en noticia.
        </div>
      ) : null}

      {item.status !== "DISCARDED" && !item.post ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-zinc-900">
              Aprobar como noticia
            </h2>
            {item.source.autopublish ? (
              <p className="mb-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
                Fuente con autopublish: al aprobar, se publica directo.
              </p>
            ) : (
              <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Fuente sin autopublish: al aprobar, queda en borradores.
              </p>
            )}

            <form action={approveRawItem} className="flex flex-col gap-3">
              <input type="hidden" name="rawItemId" value={item.id} />

              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Titular
                <input
                  name="title"
                  required
                  defaultValue={item.title ?? asString(payload.title)}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Cuerpo (texto o HTML)
                <textarea
                  name="body"
                  rows={6}
                  defaultValue={bodyText}
                  className="rounded border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-500"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Imagen (URL)
                <input
                  name="imageUrl"
                  defaultValue={imageList[0] ?? ""}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-zinc-700">
                Categoria
                <select
                  name="categoryId"
                  className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                >
                  <option value="">Sin categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-1 flex gap-3">
                <button
                  type="submit"
                  className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                >
                  Aprobar
                </button>
              </div>
            </form>
          </section>

          <section className="flex flex-col gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4">
              <h2 className="mb-2 font-semibold text-zinc-900">Acciones</h2>
              <form action={discardRawItem}>
                <input type="hidden" name="rawItemId" value={item.id} />
                <button
                  type="submit"
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                >
                  Descartar
                </button>
              </form>
            </div>

            {imageList.length > 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="mb-2 font-semibold text-zinc-900">Imagenes crudas</h2>
                <ul className="flex flex-col gap-2">
                  {imageList.map((img) => (
                    <li key={img}>
                      <a
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-xs text-blue-600 hover:underline"
                      >
                        {img}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 font-semibold text-zinc-900">Payload original</h2>
        <pre className="max-h-96 overflow-auto rounded bg-zinc-50 p-3 text-xs">
          {JSON.stringify(item.payload, null, 2)}
        </pre>
        <div className="mt-2 text-xs text-zinc-400">
          externalId: {item.externalId} · contentHash: {item.contentHash}
        </div>
      </section>
    </div>
  );
}