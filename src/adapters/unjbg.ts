import type { Source } from "@prisma/client";
import type { FetchedItem, NewsAdapter } from "./types";
import { fetchJson } from "./utils/http";

// Adaptador del portal institucional de la UNJBG (https://unjbg.edu.pe).
//
// El sitio es una SPA en AngularJS: el contenido se carga por JSON, no por
// HTML. Por eso este adaptador usa la API interna que consume la propia web:
//   - listado:  GET /pagina/section/{sectionId}/0   -> releases[]
//   - detalle:  GET /pagina/section/detail/{sectionId}/{releaseId} -> description
// sectionId se toma de la URL de la fuente (ultimo segmento) o de
// source.config.sectionId.

type UnjbgRelease = {
  id: string;
  info: string;
  image: string;
  place: string;
  title: string;
  subtitle: string;
  sectionId: string;
  date: string;
};

type UnjbgSection = {
  id: string;
  title: string;
  releasePageSize?: number;
  releases: UnjbgRelease[];
  releasesPages: number;
};

type UnjbgDetail = {
  id: string;
  info: string;
  date: string;
  image: string;
  place: string;
  title: string;
  sectionId: string;
  subtitle: string;
  description: string;
};

const MAX_ITEMS = 12;

export class UnjbgAdapter implements NewsAdapter {
  readonly source: Source;
  private readonly base: string;
  private readonly sectionId: string;

  constructor(source: Source) {
    this.source = source;
    if (!source.url) {
      throw new Error("fuente UNJBG sin url");
    }
    const parsed = new URL(source.url);
    this.base = parsed.origin;

    const config = (source.config ?? {}) as Record<string, unknown>;
    const configSectionId =
      typeof config.sectionId === "string" ? config.sectionId.trim() : "";
    this.sectionId =
      configSectionId || parsed.pathname.split("/").filter(Boolean).at(-1) || "";
    if (!this.sectionId) {
      throw new Error("fuente UNJBG sin sectionId en config o url");
    }
  }

  async fetchItems(): Promise<FetchedItem[]> {
    const listUrl = `${this.base}/pagina/section/${this.sectionId}/0`;
    const section = await fetchJson<UnjbgSection>(listUrl);

    const items: FetchedItem[] = [];
    for (const release of section.releases.slice(0, MAX_ITEMS)) {
      items.push(await this.buildItem(release));
    }
    return items;
  }

  private async buildItem(release: UnjbgRelease): Promise<FetchedItem> {
    let body = "";
    try {
      const detail = await fetchJson<UnjbgDetail>(
        `${this.base}/pagina/section/detail/${this.sectionId}/${release.id}`
      );
      body = detail.description ?? "";
    } catch {
      // Sin cuerpo no se aborta el item: queda con solo titular e imagen.
    }

    const images = release.image
      ? [new URL(release.image, this.base + "/").toString()]
      : [];

    return {
      externalId: release.id,
      title: release.title || release.subtitle || release.info || "Sin titulo",
      body,
      images,
      publishedAt: release.date,
    };
  }
}