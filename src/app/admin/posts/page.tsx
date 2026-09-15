import Link from "next/link";
import type { PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { setPostStatus } from "@/app/actions/admin";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "PUBLISHED", label: "Publicadas" },
  { value: "DRAFT", label: "Borradores" },
  { value: "REJECTED", label: "Rechazadas" },
];

const STATUS_LABELS: Record<PostStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  REJECTED: "Rechazada",
};

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireUser();

  const { status } = await searchParams;
  const filter = STATUS_OPTIONS.some((s) => s.value === status) ? status! : "ALL";

  const posts = await prisma.post.findMany({
    where: filter === "ALL" ? {} : { status: filter as PostStatus },
    include: { source: true, category: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Noticias</h1>
        <p className="text-sm text-zinc-500">
          Posts finales, filtrables por estado de publicacion.
        </p>
      </header>

      <div className="flex gap-2">
        {STATUS_OPTIONS.map((s) => (
          <Link
            key={s.value}
            href={`/admin/posts?status=${s.value}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === s.value
                ? "bg-zinc-900 text-white"
                : "border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Titulo</th>
              <th className="px-4 py-2 font-medium">Fuente</th>
              <th className="px-4 py-2 font-medium">Categoria</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Publicada</th>
              <th className="px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-zinc-50">
                <td className="max-w-[260px] px-4 py-2">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="mr-2 inline-block h-8 w-8 rounded object-cover"
                    />
                  ) : null}
                  <span className="font-medium text-zinc-800">{post.title}</span>
                </td>
                <td className="px-4 py-2 text-zinc-600">
                  {post.source?.name ?? "-"}
                </td>
                <td className="px-4 py-2 text-zinc-600">
                  {post.category?.name ?? "-"}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      post.status === "PUBLISHED"
                        ? "bg-green-50 text-green-700"
                        : post.status === "DRAFT"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                    }`}
                  >
                    {STATUS_LABELS[post.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-zinc-500">
                  {formatDate(post.publishedAt)}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    {post.status !== "PUBLISHED" ? (
                      <form action={setPostStatus}>
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="status" value="PUBLISHED" />
                        <button
                          type="submit"
                          className="rounded bg-green-700 px-3 py-1 text-xs font-medium text-white hover:bg-green-600"
                        >
                          Publicar
                        </button>
                      </form>
                    ) : null}
                    {post.status !== "REJECTED" ? (
                      <form action={setPostStatus}>
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="status" value="REJECTED" />
                        <button
                          type="submit"
                          className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
                        >
                          Rechazar
                        </button>
                      </form>
                    ) : null}
                    {post.status !== "DRAFT" ? (
                      <form action={setPostStatus}>
                        <input type="hidden" name="postId" value={post.id} />
                        <input type="hidden" name="status" value="DRAFT" />
                        <button
                          type="submit"
                          className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                        >
                          Borrador
                        </button>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                  No hay noticias con ese filtro.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}