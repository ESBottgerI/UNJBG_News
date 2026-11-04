import { describe, expect, it } from "vitest";
import {
  INGESTIBLE_TYPES,
  buildAdapter,
  isDue,
} from "@/adapters/index";
import { RssAdapter } from "@/adapters/rss";
import { SitemapWebAdapter } from "@/adapters/web";
import { UnjbgAdapter } from "@/adapters/unjbg";
import { FacebookAdapter } from "@/adapters/facebook";
import { makeSource } from "../../helpers/sources";

describe("buildAdapter", () => {
  it("crea el adaptador RSS", () => {
    expect(buildAdapter(makeSource({ type: "RSS" }))).toBeInstanceOf(RssAdapter);
  });

  it("crea el adaptador de la UNJBG cuando config.adapter lo pide", () => {
    const source = makeSource({
      type: "WEB",
      url: "https://unjbg.edu.pe/0022ba85-8ffb-4e47-2850-08d7986baac7",
      config: { adapter: "unjbg" },
    });
    expect(buildAdapter(source)).toBeInstanceOf(UnjbgAdapter);
  });

  it("usa el adaptador WEB generico para el resto de sitios", () => {
    expect(buildAdapter(makeSource({ type: "WEB", config: {} }))).toBeInstanceOf(
      SitemapWebAdapter
    );
  });

  it("crea el adaptador de Facebook", () => {
    expect(buildAdapter(makeSource({ type: "FACEBOOK" }))).toBeInstanceOf(
      FacebookAdapter
    );
  });

  it("rechaza WHATSAPP porque lo consume el worker", () => {
    expect(() => buildAdapter(makeSource({ type: "WHATSAPP" }))).toThrow(
      /WHATSAPP/
    );
  });
});

describe("isDue", () => {
  const now = new Date("2026-10-18T12:00:00.000Z");

  it("esta vencida si nunca corrio", () => {
    const source = makeSource({ lastRunAt: null });
    expect(isDue(source, now)).toBe(true);
  });

  it("no esta vencida dentro del intervalo", () => {
    const source = makeSource({
      pollIntervalMinutes: 15,
      lastRunAt: new Date("2026-10-18T11:55:00.000Z"),
    });
    expect(isDue(source, now)).toBe(false);
  });

  it("esta vencida al cumplirse el intervalo", () => {
    const source = makeSource({
      pollIntervalMinutes: 15,
      lastRunAt: new Date("2026-10-18T11:45:00.000Z"),
    });
    expect(isDue(source, now)).toBe(true);
  });

  it("exige estado ACTIVE y un intervalo configurado", () => {
    expect(isDue(makeSource({ status: "PAUSED" }), now)).toBe(false);
    expect(isDue(makeSource({ pollIntervalMinutes: null }), now)).toBe(false);
  });
});

describe("INGESTIBLE_TYPES", () => {
  it("excluye WHATSAPP", () => {
    expect(INGESTIBLE_TYPES).toEqual(["WEB", "RSS", "FACEBOOK"]);
  });
});
