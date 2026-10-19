import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";

export default async function NoticiaPage({ params }: { params: { id: string } }) {
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: { source: true, category: true },
  });

  if (!post) return notFound();

  return (
    <article className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
      {post.publishedAt && (
        <p className="text-gray-500 mb-4">{new Date(post.publishedAt).toLocaleDateString("es-PE")}</p>
      )}
      {post.imageUrl && (
        <img src={post.imageUrl} alt={post.title} className="w-full mb-4 rounded" />
      )}
      <div dangerouslySetInnerHTML={{ __html: post.bodyHtml }} className="prose max-w-none" />
      {post.source && <p className="mt-6 text-sm text-gray-600">Fuente: {post.source.name}</p>}
    </article>
  );
}
