import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnjbgAdapter } from "@/adapters/unjbg";
import { makeSource } from "../../helpers/sources";

vi.mock("@/adapters/utils/http", () => ({
  fetchText: vi.fn(),
  fetchWithRetry: vi.fn(),
  fetchJson: vi.fn(),
  sleep: vi.fn(),
}));

import { fetchJson } from "@/adapters/utils/http";

const BASE = "https://unjbg.edu.pe";
const SECTION_ID = "0022ba85-8ffb-4e47-2850-08d7986baac7";

const section = {
  id: SECTION_ID,
  title: "Noticias",
  releases: [
    {
      id: "r1",
      info: "Resumen 1",
      image: "files/foto1.jpg",
      place: "Tacna",
      title: "Titular uno",
      subtitle: "Subtitulo uno",
      sectionId: SECTION_ID,
      date: "2026-10-18T10:00:00Z",
    },
    {
      id: "r2",
      info: "Resumen 2",
      image: "",
      place: "Tacna",
      title: "",
      subtitle: "Subtitulo dos",
      sectionId: SECTION_ID,
      date: "2026-10-18T11:00:00Z",
    },
  ],
  releasesPages: 1,
};

const detail = {
  id: "r1",
  info: "Resumen 1",
  date: "2026-10-18T10:00:00Z",
  image: "",
  place: "Tacna",
  title: "Titular uno",
  sectionId: SECTION_ID,
  subtitle: "Subtitulo uno",
  description: "<p>Cuerpo completo</p>",
};

describe("UnjbgAdapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("arma los items usando el listado y el detalle", async () => {
    vi.mocked(fetchJson).mockImplementation(async (url: string) => {
      if (url.endsWith(`/detail/${SECTION_ID}/r1`)) return detail as never;
      if (url.endsWith(`/section/${SECTION_ID}/0`)) return section as never;
      throw new Error("no encontrado");
    });

    const adapter = new UnjbgAdapter(
      makeSource({ url: `${BASE}/${SECTION_ID}` })
    );
    const items = await adapter.fetchItems();

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "r1",
      title: "Titular uno",
      body: "<p>Cuerpo completo</p>",
      images: [`${BASE}/files/foto1.jpg`],
      publishedAt: "2026-10-18T10:00:00Z",
    });
  });

  it("si el detalle falla conserva titular e imagen", async () => {
    vi.mocked(fetchJson).mockImplementation(async (url: string) => {
      if (url.includes("/detail/")) throw new Error("sin detalle");
      return section as never;
    });

    const adapter = new UnjbgAdapter(
      makeSource({ url: `${BASE}/${SECTION_ID}` })
    );
    const items = await adapter.fetchItems();

    expect(items).toHaveLength(2);
    expect(items[0].body).toBe("");
    expect(items[0].title).toBe("Titular uno");
    expect(items[1].title).toBe("Subtitulo dos");
    expect(items[1].images).toEqual([]);
  });

  it("usa config.sectionId antes que el ultimo segmento de la URL", async () => {
    vi.mocked(fetchJson).mockResolvedValue(section as never);

    const adapter = new UnjbgAdapter(
      makeSource({
        url: `${BASE}/otra-seccion`,
        config: { sectionId: SECTION_ID },
      })
    );
    await adapter.fetchItems();

    expect(fetchJson).toHaveBeenCalledWith(
      `${BASE}/pagina/section/${SECTION_ID}/0`
    );
  });

  it("exige url y sectionId", () => {
    expect(
      () => new UnjbgAdapter(makeSource({ url: null }))
    ).toThrow(/sin url/i);
    expect(
      () => new UnjbgAdapter(makeSource({ url: `${BASE}/` }))
    ).toThrow(/sectionId/i);
  });
});
