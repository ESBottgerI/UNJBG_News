import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export default async function AdminDashboardPage() {
  await requireUser();

  const [
    pendingRaw,
    postsPublished,
    postsDraft,
    postsRejected,
    totalSources,
    totalCategories,
    recentRaw,
    recentPosts,
  ] = await Promise.all([
    prisma.rawItem.count({ where: { status: "NEW" } }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({ where: { status: "DRAFT" } }),
    prisma.post.count({ where: { status: "REJECTED" } }),
    prisma.source.count(),
    prisma.category.count(),
    prisma.rawItem.findMany({
      include: { source: true },
      orderBy: { seenAt: "desc" },
      take: 5,
    }),
    prisma.post.findMany({
      include: { source: true, category: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const cards = [
    { label: "En cola por revisar", value: pendingRaw, href: "/admin/queue" },
    { label: "Publicadas", value: postsPublished, href: "/admin/posts?status=PUBLISHED" },
    { label: "Borradores", value: postsDraft, href: "/admin/posts?status=DRAFT" },
    { label: "Rechazadas", value: postsRejected, href: "/admin/posts?status=REJECTED" },
    { label: "Fuentes", value: totalSources, href: "/admin/sources" },
    { label: "Categorias", value: totalCategories, href: "/admin/categories" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500">Resumen del compilador de noticias.</p>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="text-3xl font-bold text-zinc-900">{card.value}</div>
            <div className="mt-1 text-sm text-zinc-500">{card.label}</div>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-zinc-900">Ultimos items en la cola</h2>
          <ul className="divide-y divide-zinc-100 text-sm">
            {recentRaw.map((item) => (
              <li key={item.id} className="py-2">
                <Link
                  href={`/admin/queue/${item.id}`}
                  className="font-medium text-zinc-800 hover:underline"
                >
                  {item.title ?? "(sin titulo)"}
                </Link>
                <div className="text-xs text-zinc-400">
                  {item.source.name} · {formatDate(item.seenAt)}
                </div>
              </li>
            ))}
            {recentRaw.length === 0 ? (
              <li className="py-2 text-zinc-400">Sin items en la cola.</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 font-semibold text-zinc-900">Ultimas noticias</h2>
          <ul className="divide-y divide-zinc-100 text-sm">
            {recentPosts.map((post) => (
              <li key={post.id} className="py-2">
                <span className="font-medium text-zinc-800">{post.title}</span>
                <div className="text-xs text-zinc-400">
                  {post.source?.name ?? "sin fuente"} · {post.category?.name ?? "sin categoria"} ·{" "}
                  {formatDate(post.createdAt)}
                </div>
              </li>
            ))}
            {recentPosts.length === 0 ? (
              <li className="py-2 text-zinc-400">Todavia no hay noticias.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}