import Link from "next/link";
import type { IngestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

const FILTERS: { value: string; label: string }[] = [
  { value: "NEW", label: "Por revisar" },
  { value: "PROCESSED", label: "Procesados" },
  { value: "DISCARDED", label: "Descartados" },
];

const STATUS_LABELS: Record<IngestStatus, string> = {
  NEW: "Nuevo",
  PROCESSED: "Procesado",
  DISCARDED: "Descartado",
};

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireUser();

  const { status } = await searchParams;
  const filter = FILTERS.some((f) => f.value === status) ? status! : "NEW";

  const items = await prisma.rawItem.findMany({
    where: { status: filter as IngestStatus },
    include: { source: true, post: true },
    orderBy: { seenAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Cola de revision</h1>
        <p className="text-sm text-zinc-500">
          Contenido crudo que llega de las fuentes (adaptadores de Fase 2+).
        </p>
      </header>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/queue?status=${f.value}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === f.value
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Titulo</th>
              <th className="px-4 py-2 font-medium">Fuente</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Llego</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/queue/${item.id}`}
                    className="font-medium text-zinc-800 hover:underline"
                  >
                    {item.title ?? "(sin titulo)"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-zinc-600">{item.source.name}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      item.status === "NEW"
                        ? "bg-blue-50 text-blue-700"
                        : item.status === "PROCESSED"
                          ? "bg-green-50 text-green-700"
                          : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-zinc-500">{formatDate(item.seenAt)}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  No hay items con ese estado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}