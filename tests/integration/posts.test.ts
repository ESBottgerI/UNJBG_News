import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCategory,
  createPost,
  createSource,
  disconnect,
  prisma,
  resetDatabase,
  unique,
} from "../helpers/db";
import {
  getCategoryBySlug,
  getMostRead,
  getPublishedPost,
  getRelated,
  incrementPostViews,
  listCategories,
  listPublished,
  searchPublished,
} from "@/lib/posts";

describe("posts (capa de datos publica)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe("listPublished", () => {
    it("solo devuelve posts PUBLISHED ordenados por fecha", async () => {
      const newest = await createPost({
        title: "Mas nueva",
        publishedAt: new Date("2026-10-20T10:00:00.000Z"),
      });
      const older = await createPost({
        title: "Mas vieja",
        publishedAt: new Date("2026-10-18T10:00:00.000Z"),
      });
      await createPost({ title: "Borrador", status: "DRAFT" });
      await createPost({ title: "Rechazada", status: "REJECTED" });

      const result = await listPublished();

      expect(result.total).toBe(2);
      expect(result.posts.map((p) => p.id)).toEqual([newest.id, older.id]);
      expect(result.page).toBe(1);
      expect(result.pageCount).toBe(1);
    });

    it("pagina los resultados", async () => {
      const posts = [];
      for (let i = 0; i < 5; i++) {
        posts.push(
          await createPost({
            title: unique(`Noticia ${i}`),
            publishedAt: new Date(`2026-10-${20 - i}T10:00:00.000Z`),
          })
        );
      }

      const page1 = await listPublished({ page: 1, pageSize: 2 });
      const page2 = await listPublished({ page: 2, pageSize: 2 });
      const page3 = await listPublished({ page: 3, pageSize: 2 });

      expect(page1.posts.map((p) => p.id)).toEqual([posts[0].id, posts[1].id]);
      expect(page2.posts.map((p) => p.id)).toEqual([posts[2].id, posts[3].id]);
      expect(page3.posts.map((p) => p.id)).toEqual([posts[4].id]);
      expect(page1.pageCount).toBe(3);
      expect(page1.total).toBe(5);
    });

    it("filtra por slug de categoria", async () => {
      const local = await createCategory({ name: "Local", slug: "local" });
      const otros = await createCategory({ name: "Otros", slug: "otros" });
      await createPost({ title: "Local 1", categoryId: local.id });
      await createPost({ title: "Local 2", categoryId: local.id });
      await createPost({ title: "Otros 1", categoryId: otros.id });

      const result = await listPublished({ categorySlug: "local" });

      expect(result.total).toBe(2);
      expect(result.posts.every((p) => p.category?.slug === "local")).toBe(true);
    });

    it("normaliza paginas invalidas a la primera", async () => {
      await createPost({ title: "Unica" });

      await expect(listPublished({ page: 0 }).then((r) => r.page)).resolves.toBe(1);
      await expect(listPublished({ page: -3 }).then((r) => r.page)).resolves.toBe(1);
    });

    it("devuelve un listado vacio sin posts publicados", async () => {
      const result = await listPublished();
      expect(result.posts).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.pageCount).toBe(1);
    });
  });

  describe("getPublishedPost", () => {
    it("devuelve la noticia publicada con categoria y fuente", async () => {
      const category = await createCategory();
      const source = await createSource();
      const post = await createPost({
        title: "Publicada",
        categoryId: category.id,
        sourceId: source.id,
      });

      const found = await getPublishedPost(post.id);

      expect(found?.id).toBe(post.id);
      expect(found?.category?.id).toBe(category.id);
      expect(found?.source?.id).toBe(source.id);
    });

    it("no expone borradores ni rechazados", async () => {
      const draft = await createPost({ status: "DRAFT" });
      const rejected = await createPost({ status: "REJECTED" });

      await expect(getPublishedPost(draft.id)).resolves.toBeNull();
      await expect(getPublishedPost(rejected.id)).resolves.toBeNull();
      await expect(getPublishedPost("no-existe")).resolves.toBeNull();
    });
  });

  describe("getMostRead", () => {
    it("ordena por visitas y respeta el limite", async () => {
      const low = await createPost({ title: "Pocas", views: 1 });
      const high = await createPost({ title: "Muchas", views: 100 });
      const mid = await createPost({ title: "Medias", views: 50 });
      await createPost({ title: "Borrador", status: "DRAFT", views: 999 });

      const result = await getMostRead(2);

      expect(result.map((p) => p.id)).toEqual([high.id, mid.id]);
      expect(result.map((p) => p.id)).not.toContain(low.id);
    });
  });

  describe("getRelated", () => {
    it("devuelve publicadas de la misma categoria excluyendo la actual", async () => {
      const category = await createCategory();
      const current = await createPost({ categoryId: category.id });
      const related = await createPost({ categoryId: category.id });
      await createPost({ categoryId: category.id, status: "DRAFT" });
      await createPost({ status: "PUBLISHED" });

      const result = await getRelated(category.id, current.id);

      expect(result.map((p) => p.id)).toEqual([related.id]);
    });
  });

  describe("searchPublished", () => {
    it("encuentra posts publicados y respeta el estado", async () => {
      const match = await createPost({
        title: "Universidad Nacional de Tacna",
        bodyHtml: "<p>Noticia regional</p>",
      });
      await createPost({
        title: "Universidad Nacional en borrador",
        status: "DRAFT",
      });

      const result = await searchPublished("universidad");

      expect(result.map((p) => p.id)).toEqual([match.id]);
    });

    it("devuelve vacio con consultas muy cortas o sin coincidencias", async () => {
      await createPost({ title: "Universidad Nacional de Tacna" });

      await expect(searchPublished("u")).resolves.toEqual([]);
      await expect(searchPublished("   ")).resolves.toEqual([]);
      await expect(searchPublished("zzzzz")).resolves.toEqual([]);
    });

    it("no falla con signos de la consulta del usuario", async () => {
      await createPost({ title: "Noticia sobre Tacna" });

      await expect(searchPublished('Tacna & "comillas" (x)')).resolves.toEqual(
        []
      );
    });
  });

  describe("categorias y visitas", () => {
    it("lista categorias ordenadas por nombre y busca por slug", async () => {
      await createCategory({ name: "Zeta", slug: "zeta" });
      await createCategory({ name: "Alfa", slug: "alfa" });

      const all = await listCategories();
      expect(all.map((c) => c.name)).toEqual(["Alfa", "Zeta"]);

      const found = await getCategoryBySlug("alfa");
      expect(found?.name).toBe("Alfa");
      await expect(getCategoryBySlug("no-existe")).resolves.toBeNull();
    });

    it("incrementa las visitas y no falla con ids inexistentes", async () => {
      const post = await createPost();

      await incrementPostViews(post.id);
      await incrementPostViews(post.id);

      const updated = await prisma.post.findUniqueOrThrow({
        where: { id: post.id },
      });
      expect(updated.views).toBe(2);
      await expect(incrementPostViews("no-existe")).resolves.toBeUndefined();
    });
  });
});
