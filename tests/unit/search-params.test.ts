import { describe, expect, it } from "vitest";
import { firstValue, readPage } from "@/lib/search-params";

describe("firstValue", () => {
  it("devuelve cadena vacia si falta", () => {
    expect(firstValue(undefined)).toBe("");
  });

  it("devuelve el primer elemento de un arreglo", () => {
    expect(firstValue(["a", "b"])).toBe("a");
  });

  it("devuelve el valor unico", () => {
    expect(firstValue("hola")).toBe("hola");
  });
});

describe("readPage", () => {
  it("usa 1 por defecto", () => {
    expect(readPage({})).toBe(1);
  });

  it("lee una pagina valida", () => {
    expect(readPage({ page: "3" })).toBe(3);
  });

  it("ignora valores invalidos o negativos", () => {
    expect(readPage({ page: "0" })).toBe(1);
    expect(readPage({ page: "-2" })).toBe(1);
    expect(readPage({ page: "abc" })).toBe(1);
  });

  it("acepta arreglos y usa el primer valor", () => {
    expect(readPage({ page: ["4", "9"] })).toBe(4);
  });
});
