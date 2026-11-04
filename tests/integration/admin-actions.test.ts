import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCategory, createRawItem, createSource, createUser, disconnect, prisma, resetDatabase } from "../helpers/db";

const cookieState = vi.hoisted(() => ({
  token: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "unjbg_session" && cookieState.token
        ? { name, value: cookieState.token }
        : undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { approveRawItem, discardRawItem } from "@/app/actions/admin";
import { createSessionToken } from "@/lib/auth/session";

const MALICIOUS_BODY =
  '<p>Texto <strong>legitimo</strong></p><script>alert("xss")</script>' +
  '<img src="https://example.test/a.jpg" onerror="alert(1)">' +
  '<a href="javascript:alert(1)">click</a>';

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeAll(() => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "secreto-de-test";
});

beforeEach(async () => {
  await resetDatabase();
  const editor = await createUser({ role: "EDITOR" });
  cookieState.token = createSessionToken(editor.id);
});

afterAll(async () => {
  await disconnect();
});

describe("approveRawItem", () => {
  it("sanea el HTML del formulario (regresion de XSS almacenado)", async () => {
    const source = await createSource({ autopublish: false });
    const raw = await createRawItem(source.id, { status: "NEW" });

    await expect(
      approveRawItem(
        form({
          rawItemId: raw.id,
          title: "Titular aprobado",
          body: MALICIOUS_BODY,
        })
      )
    ).rejects.toThrow(/REDIRECT/);

    const post = await prisma.post.findUniqueOrThrow({
      where: { rawItemId: raw.id },
    });
    expect(post.bodyHtml).toContain("<strong>legitimo</strong>");
    expect(post.bodyHtml).not.toContain("<script");
    expect(post.bodyHtml).not.toContain("onerror");
    expect(post.bodyHtml).not.toContain("javascript:");
    expect(post.bodyHtml).not.toContain("alert");
  });

  it("crea un borrador cuando la fuente no autopublica", async () => {
    const source = await createSource({ autopublish: false });
    const raw = await createRawItem(source.id, { status: "NEW" });
    const category = await createCategory();

    await expect(
      approveRawItem(
        form({
          rawItemId: raw.id,
          title: "  Titular  ",
          body: "<p>Cuerpo</p>",
          categoryId: category.id,
          imageUrl: "/media/foto.jpg",
        })
      )
    ).rejects.toThrow(/REDIRECT:\/admin\/posts/);

    const post = await prisma.post.findUniqueOrThrow({
      where: { rawItemId: raw.id },
    });
    expect(post).toMatchObject({
      title: "Titular",
      status: "DRAFT",
      categoryId: category.id,
      imageUrl: "/media/foto.jpg",
    });
    expect(post.publishedAt).toBeNull();
    expect(post.authorId).not.toBeNull();
    expect(post.moderatedAt).not.toBeNull();

    const updated = await prisma.rawItem.findUniqueOrThrow({
      where: { id: raw.id },
    });
    expect(updated.status).toBe("PROCESSED");
    expect(updated.processedAt).not.toBeNull();
  });

  it("publica directo si la fuente tiene autopublish", async () => {
    const source = await createSource({ autopublish: true });
    const raw = await createRawItem(source.id, { status: "NEW" });

    await expect(
      approveRawItem(
        form({ rawItemId: raw.id, title: "Publicada", body: "<p>ok</p>" })
      )
    ).rejects.toThrow(/REDIRECT/);

    const post = await prisma.post.findUniqueOrThrow({
      where: { rawItemId: raw.id },
    });
    expect(post.status).toBe("PUBLISHED");
    expect(post.publishedAt).toBeInstanceOf(Date);
  });

  it("exige el titular", async () => {
    const source = await createSource();
    const raw = await createRawItem(source.id, { status: "NEW" });

    await expect(
      approveRawItem(form({ rawItemId: raw.id, title: "   ", body: "<p>x</p>" }))
    ).rejects.toThrow(/titular es obligatorio/i);

    await expect(prisma.post.count()).resolves.toBe(0);
  });

  it("rechaza items descartados o inexistentes", async () => {
    const source = await createSource();
    const discarded = await createRawItem(source.id, { status: "DISCARDED" });

    await expect(
      approveRawItem(
        form({ rawItemId: discarded.id, title: "Titular", body: "<p>x</p>" })
      )
    ).rejects.toThrow(/descartado/i);

    await expect(
      approveRawItem(
        form({ rawItemId: "no-existe", title: "Titular", body: "<p>x</p>" })
      )
    ).rejects.toThrow(/no encontrado/i);
  });

  it("redirige al login sin sesion", async () => {
    cookieState.token = undefined;
    const source = await createSource();
    const raw = await createRawItem(source.id);

    await expect(
      approveRawItem(form({ rawItemId: raw.id, title: "Titular", body: "<p>x</p>" }))
    ).rejects.toThrow(/REDIRECT:\/admin\/login/);
  });
});

describe("discardRawItem", () => {
  it("marca el item como descartado y redirige a la cola", async () => {
    const source = await createSource();
    const raw = await createRawItem(source.id, { status: "NEW" });

    await expect(
      discardRawItem(form({ rawItemId: raw.id }))
    ).rejects.toThrow(/REDIRECT:\/admin\/queue/);

    const updated = await prisma.rawItem.findUniqueOrThrow({
      where: { id: raw.id },
    });
    expect(updated.status).toBe("DISCARDED");
    expect(updated.processedAt).not.toBeNull();
  });
});
