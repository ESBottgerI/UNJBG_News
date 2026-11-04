import { beforeEach, describe, expect, it, vi } from "vitest";
import { RssAdapter } from "@/adapters/rss";
import { makeSource } from "../../helpers/sources";

vi.mock("@/adapters/utils/http", () => ({
  fetchText: vi.fn(),
  fetchWithRetry: vi.fn(),
  fetchJson: vi.fn(),
  sleep: vi.fn(),
}));

import { fetchText } from "@/adapters/utils/http";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Feed de prueba</title>
    <item>
      <title>Noticia uno</title>
      <link>https://example.test/1</link>
      <guid>guid-1</guid>
      <description><![CDATA[<p>Hola <b>mundo</b></p>]]></description>
      <pubDate>Mon, 20 Oct 2026 10:00:00 GMT</pubDate>
      <enclosure url="https://example.test/a.jpg" type="image/jpeg" />
      <media:content url="https://example.test/b.jpg" />
    </item>
    <item>
      <title>Noticia dos</title>
      <link>https://example.test/2</link>
      <description>Sin guid</description>
    </item>
    <item>
      <description>Sin titulo ni id</description>
    </item>
  </channel>
</rss>`;

describe("RssAdapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("normaliza items, deduplica por guid/link y limpia el HTML", async () => {
    vi.mocked(fetchText).mockResolvedValue(FEED);
    const adapter = new RssAdapter(makeSource({ type: "RSS" }));

    const items = await adapter.fetchItems();

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "guid-1",
      title: "Noticia uno",
      body: "Hola mundo",
    });
    expect(items[0].images).toEqual(["https://example.test/a.jpg"]);
    expect(items[0].publishedAt).toBe("2026-10-20T10:00:00.000Z");
    expect(items[1]).toMatchObject({
      externalId: "https://example.test/2",
      title: "Noticia dos",
      body: "Sin guid",
    });
  });

  it("respeta config.maxItems", async () => {
    vi.mocked(fetchText).mockResolvedValue(FEED);
    const adapter = new RssAdapter(
      makeSource({ type: "RSS", config: { maxItems: 1 } })
    );

    await expect(adapter.fetchItems()).resolves.toHaveLength(1);
  });

  it("falla claro si la fuente no tiene URL", async () => {
    const adapter = new RssAdapter(makeSource({ type: "RSS", url: null }));
    await expect(adapter.fetchItems()).rejects.toThrow(/sin url/i);
  });
});
