import { describe, expect, it } from "vitest";
import { cleanText, sanitizeBody } from "@/lib/pipeline/sanitize";

describe("sanitizeBody", () => {
  it("elimina scripts y estilos", () => {
    const out = sanitizeBody(
      '<p>Hola</p><script>alert("xss")</script><style>body{}</style>'
    );
    expect(out).toBe("<p>Hola</p>");
  });

  it("elimina atributos peligrosos como onerror y javascript:", () => {
    const out = sanitizeBody(
      '<img src="x" onerror="alert(1)"><a href="javascript:alert(1)">link</a>'
    );
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("javascript:");
  });

  it("conserva etiquetas permitidas y agrega rel/target a los enlaces", () => {
    const out = sanitizeBody('<p><strong>ok</strong> <a href="https://x.test">ir</a></p>');
    expect(out).toContain("<strong>ok</strong>");
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('target="_blank"');
  });

  it("devuelve cadena vacia para entradas vacias", () => {
    expect(sanitizeBody("")).toBe("");
  });
});

describe("cleanText", () => {
  it("quita script/style y colapsa espacios", () => {
    const out = cleanText(
      "  <script>alert(1)</script><style>x</style>  Hola \n  mundo  "
    );
    expect(out).toBe("Hola mundo");
  });

  it("soporta texto sin etiquetas", () => {
    expect(cleanText("a   b\tc")).toBe("a b c");
  });
});
