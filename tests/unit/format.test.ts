import { describe, expect, it } from "vitest";
import {
  excerpt,
  formatDate,
  formatDateLong,
  formatDateShort,
  stripHtml,
} from "@/lib/format";

const sample = new Date("2026-10-18T15:30:00.000Z");

describe("fechas", () => {
  it("formatDate devuelve guion para valores vacios", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
  });

  it("formatDateLong devuelve cadena vacia para valores vacios", () => {
    expect(formatDateLong(null)).toBe("");
    expect(formatDateShort(undefined)).toBe("");
  });

  it("formatea el ano y el mes en espanol", () => {
    expect(formatDate(sample)).toContain("2026");
    expect(formatDateLong(sample)).toContain("2026");
    expect(formatDateShort(sample)).toContain("2026");
    expect(formatDateShort(sample)).toContain("octubre");
  });
});

describe("stripHtml", () => {
  it("quita etiquetas y decodifica entidades basicas", () => {
    expect(stripHtml("<p>Hola&nbsp;<b>mundo</b> &amp; todos</p>")).toBe(
      "Hola mundo & todos"
    );
  });

  it("colapsa espacios y saltos de linea", () => {
    expect(stripHtml("a\n\n   b\t c")).toBe("a b c");
  });
});

describe("excerpt", () => {
  it("devuelve el texto completo si es corto", () => {
    expect(excerpt("<p>Una noticia corta</p>", 100)).toBe("Una noticia corta");
  });

  it("corta en un limite de palabra y agrega puntos suspensivos", () => {
    const out = excerpt("<p>uno dos tres cuatro cinco</p>", 12);
    expect(out).toBe("uno dos…");
    expect(out.endsWith("…")).toBe(true);
  });

  it("respeta el maximo aunque no haya espacios", () => {
    const out = excerpt("x".repeat(50), 10);
    expect(out).toBe("xxxxxxxxxx…");
  });
});
