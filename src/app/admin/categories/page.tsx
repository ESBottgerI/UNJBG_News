import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { createCategory, deleteCategory, updateCategory } from "@/app/actions/admin";

export default async function AdminCategoriesPage() {
  await requireAdmin();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">Categorias</h1>
        <p className="text-sm text-zinc-500">
          Secciones del sitio (Local, UNJBG, Regional, ...).
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-zinc-900">Nueva categoria</h2>
        <form action={createCategory} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Nombre
            <input
              name="name"
              required
              placeholder="Nacional"
              className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-700">
            Slug (si se deja vacio, se genera del nombre)
            <input
              name="slug"
              placeholder="nacional"
              className="rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Crear
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2 font-medium">Categoria</th>
              <th className="px-4 py-2 font-medium">Slug</th>
              <th className="px-4 py-2 font-medium">Noticias</th>
              <th className="px-4 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {categories.map((cat) => (
              <tr key={cat.id} className="hover:bg-zinc-50">
                <td className="px-4 py-2 font-medium text-zinc-800">{cat.name}</td>
                <td className="px-4 py-2 text-zinc-500">{cat.slug}</td>
                <td className="px-4 py-2 text-zinc-500">{cat._count.posts}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <form
                      action={updateCategory}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="categoryId" value={cat.id} />
                      <input
                        name="name"
                        defaultValue={cat.name}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-500"
                      />
                      <input
                        name="slug"
                        defaultValue={cat.slug}
                        className="rounded border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-500"
                      />
                      <button
                        type="submit"
                        className="rounded bg-zinc-800 px-2 py-1 text-xs text-white hover:bg-zinc-600"
                      >
                        Guardar
                      </button>
                    </form>
                    <form action={deleteCategory}>
                      <input type="hidden" name="categoryId" value={cat.id} />
                      <button
                        type="submit"
                        className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  No hay categorias todavia.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}