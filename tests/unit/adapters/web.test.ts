import { beforeEach, describe, expect, it, vi } from "vitest";
import { SitemapWebAdapter } from "@/adapters/web";
import { makeSource } from "../../helpers/sources";

vi.mock("@/adapters/utils/http", () => ({
  fetchText: vi.fn(),
  fetchWithRetry: vi.fn(),
  fetchJson: vi.fn(),
  sleep: vi.fn(),
}));

import { fetchText, fetchWithRetry, sleep } from "@/adapters/utils/http";

function response(html: string): Response {
  return { text: async () => html } as unknown as Response;
}

const URLSET = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.test/n1</loc></url>
  <url><loc>https://example.test/n2</loc></url>
</urlset>`;

const ARTICLE_OG = `<html><head>
  <meta property="og:title" content="Titulo OG" />
  <meta property="og:description" content="Bajada OG" />
  <meta property="og:image" content="https://example.test/img.jpg" />
</head><body></body></html>`;

const ARTICLE_H1 = `<html><body><h1>Solo H1</h1></body></html>`;

describe("SitemapWebAdapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lee un urlset y extrae titulo, bajada e imagen de Open Graph", async () => {
    vi.mocked(fetchText).mockResolvedValue(URLSET);
    vi.mocked(fetchWithRetry).mockImplementation(async (url: string) =>
      response(url.endsWith("/n1") ? ARTICLE_OG : ARTICLE_H1)
    );

    const adapter = new SitemapWebAdapter(makeSource());
    const items = await adapter.fetchItems();

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "https://example.test/n1",
      title: "Titulo OG",
      body: "Bajada OG",
      images: ["https://example.test/img.jpg"],
    });
    expect(items[1]).toMatchObject({
      externalId: "https://example.test/n2",
      title: "Solo H1",
      body: "",
      images: [],
    });
  });

  it("soporta sitemapindex de un nivel", async () => {
    vi.mocked(fetchText).mockImplementation(async (url: string) => {
      if (url.endsWith("child.xml")) return URLSET;
      return `<?xml version="1.0"?>
        <sitemapindex><sitemap><loc>https://example.test/child.xml</loc></sitemap></sitemapindex>`;
    });
    vi.mocked(fetchWithRetry).mockResolvedValue(response(ARTICLE_OG));

    const adapter = new SitemapWebAdapter(makeSource());
    const items = await adapter.fetchItems();

    expect(items).toHaveLength(2);
    expect(fetchText).toHaveBeenCalledWith("https://example.test/child.xml");
  });

  it("usa JSON-LD cuando no hay Open Graph", async () => {
    vi.mocked(fetchText).mockResolvedValue(URLSET);
    const ld = `<html><head><script type="application/ld+json">
      {"@type":"NewsArticle","headline":"Titular LD","description":"Bajada LD",
       "image":"https://example.test/ld.jpg","datePublished":"2026-10-18T10:00:00Z"}
    </script></head></html>`;
    vi.mocked(fetchWithRetry).mockResolvedValue(response(ld));

    const adapter = new SitemapWebAdapter(makeSource());
    const items = await adapter.fetchItems();

    expect(items[0]).toMatchObject({
      title: "Titular LD",
      body: "Bajada LD",
      images: ["https://example.test/ld.jpg"],
      publishedAt: "2026-10-18T10:00:00Z",
    });
  });

  it("una pagina que falla no aborta el resto del sitemap", async () => {
    vi.mocked(fetchText).mockResolvedValue(URLSET);
    vi.mocked(fetchWithRetry).mockImplementation(async (url: string) => {
      if (url.endsWith("/n1")) throw new Error("timeout");
      return response(ARTICLE_H1);
    });

    const adapter = new SitemapWebAdapter(makeSource());
    const items = await adapter.fetchItems();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Solo H1");
  });

  it("respeta maxItems, sitemapPath y requestDelayMs", async () => {
    vi.mocked(fetchText).mockResolvedValue(URLSET);
    vi.mocked(fetchWithRetry).mockResolvedValue(response(ARTICLE_H1));

    const adapter = new SitemapWebAdapter(
      makeSource({
        config: {
          maxItems: 1,
          sitemapPath: "/noticias/sitemap.xml",
          requestDelayMs: 25,
        },
      })
    );
    const items = await adapter.fetchItems();

    expect(items).toHaveLength(1);
    expect(fetchText).toHaveBeenCalledWith(
      "https://example.test/noticias/sitemap.xml"
    );
    expect(sleep).toHaveBeenCalledWith(25);
  });

  it("falla claro si la fuente no tiene URL", async () => {
    const adapter = new SitemapWebAdapter(makeSource({ url: null }));
    await expect(adapter.fetchItems()).rejects.toThrow(/sin url/i);
  });
});
