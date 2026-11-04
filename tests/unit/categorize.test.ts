import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { categorize, getCategoryByName } from "@/lib/pipeline/categorize";

describe("categorize", () => {
  it("respeta la categoria ya asignada", () => {
    expect(categorize("tacna universidad", "cat-existente")).toBe("cat-existente");
  });

  it("devuelve null con texto vacio", () => {
    expect(categorize("")).toBeNull();
  });

  it("detecta UNJBG antes que Local", () => {
    expect(categorize("Universidad Nacional Jorge Basadre Grohmann en Tacna")).toBe(
      "UNJBG"
    );
  });

  it("detecta noticias locales de Tacna", () => {
    expect(categorize("Vecinos de Pocollay reportan corte de agua")).toBe("Local");
  });

  it("detecta la region (Moquegua/Ilo)", () => {
    expect(categorize("Obras en el puerto de Ilo avanzan")).toBe("Regional");
  });

  it("detecta noticias nacionales", () => {
    expect(categorize("El Congreso aprobo una nueva ley")).toBe("Nacional");
  });

  it("cae en Otros cuando no hay palabras clave", () => {
    expect(categorize("Un equipo de futbol gano el torneo")).toBe("Otros");
  });

  it("no distingue mayusculas ni tildes de las claves", () => {
    expect(categorize("UNIVERSIDAD NACIONAL")).toBe("UNJBG");
  });
});

describe("getCategoryByName", () => {
  it("consulta por nombre y devuelve la categoria", async () => {
    const category = { id: "cat-1", name: "Local", slug: "local" };
    const findUnique = vi.fn().mockResolvedValue(category);
    const prisma = { category: { findUnique } } as unknown as PrismaClient;

    await expect(getCategoryByName("Local", prisma)).resolves.toEqual(category);
    expect(findUnique).toHaveBeenCalledWith({ where: { name: "Local" } });
  });
});
