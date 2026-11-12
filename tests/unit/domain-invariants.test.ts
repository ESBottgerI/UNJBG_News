import { describe, expect, it } from "vitest";
import {
  assertNoViolations,
  checkCategoryInvariants,
  checkPostInvariants,
  checkRawItemInvariants,
  checkSourceInvariants,
  checkSourceRunInvariants,
  checkUserInvariants,
} from "@/lib/domain/invariants";

const validSource = {
  name: "UNJBG",
  type: "WEB" as const,
  status: "ACTIVE" as const,
  autopublish: false,
  pollIntervalMinutes: 15,
  consecutiveFailures: 0,
};

const validRawItem = {
  externalId: "post-1",
  contentHash: "a".repeat(64),
  status: "NEW" as const,
  processedAt: null,
  hasSource: true,
  postCount: 0,
};

const validPost = {
  title: "Titular",
  bodyHtml: "<p>Cuerpo</p>",
  status: "DRAFT" as const,
  publishedAt: null,
  views: 0,
};

describe("checkSourceInvariants", () => {
  it("acepta una fuente valida", () => {
    expect(checkSourceInvariants(validSource)).toEqual([]);
  });

  it("rechaza WHATSAPP con intervalo de polling", () => {
    expect(
      checkSourceInvariants({
        ...validSource,
        type: "WHATSAPP",
        pollIntervalMinutes: 5,
      })
    ).toContain("Source WHATSAPP no debe tener pollIntervalMinutes");
  });

  it("rechaza nombre vacio y fallos negativos", () => {
    const violations = checkSourceInvariants({
      ...validSource,
      name: "  ",
      consecutiveFailures: -1,
    });
    expect(violations).toContain("Source.name no puede estar vacio");
    expect(violations).toContain(
      "Source.consecutiveFailures no puede ser negativo"
    );
  });
});

describe("checkRawItemInvariants", () => {
  it("acepta un item NEW sin post", () => {
    expect(checkRawItemInvariants(validRawItem)).toEqual([]);
  });

  it("exige processedAt en estados finales", () => {
    expect(
      checkRawItemInvariants({
        ...validRawItem,
        status: "PROCESSED",
        processedAt: null,
      })
    ).toContain("RawItem PROCESSED requiere processedAt no nulo");
  });

  it("rechaza mas de un post por item", () => {
    expect(
      checkRawItemInvariants({ ...validRawItem, postCount: 2 })
    ).toContain("RawItem no puede producir mas de un Post");
  });

  it("rechaza hash que no sea SHA-256", () => {
    expect(
      checkRawItemInvariants({ ...validRawItem, contentHash: "abc" })
    ).toContain("RawItem.contentHash debe ser SHA-256 (64 hex)");
  });
});

describe("checkPostInvariants", () => {
  it("acepta un borrador coherente", () => {
    expect(checkPostInvariants(validPost)).toEqual([]);
  });

  it("exige publishedAt cuando esta PUBLISHED", () => {
    expect(
      checkPostInvariants({
        ...validPost,
        status: "PUBLISHED",
        publishedAt: null,
      })
    ).toContain("Post PUBLISHED requiere publishedAt no nulo");
  });

  it("rechaza publishedAt en un borrador", () => {
    expect(
      checkPostInvariants({ ...validPost, publishedAt: new Date() })
    ).toContain("Post DRAFT no debe tener publishedAt");
  });

  it("detecta HTML peligroso", () => {
    const violations = checkPostInvariants({
      ...validPost,
      bodyHtml: '<script>alert(1)</script><a href="javascript:x">x</a>',
    });
    expect(violations).toContain("Post.bodyHtml no puede contener <script>");
    expect(violations).toContain(
      "Post.bodyHtml no puede contener javascript:"
    );
  });
});

describe("otras invariantes", () => {
  it("valida categorias", () => {
    expect(
      checkCategoryInvariants({ name: "Local", slug: "local" })
    ).toEqual([]);
    expect(
      checkCategoryInvariants({ name: "", slug: "LOCAL" })
    ).toHaveLength(2);
  });

  it("valida usuarios", () => {
    expect(
      checkUserInvariants({
        email: "editor@unjbg.local",
        passwordHash: "scrypt:salt:hash",
        role: "EDITOR",
      })
    ).toEqual([]);
    expect(
      checkUserInvariants({
        email: "no-es-email",
        passwordHash: "plano",
        role: "ADMIN",
      })
    ).toHaveLength(2);
  });

  it("valida corridas de fuente", () => {
    expect(
      checkSourceRunInvariants({
        status: "OK",
        fetched: 3,
        newItems: 1,
        duplicates: 2,
        durationMs: 100,
        error: null,
      })
    ).toEqual([]);
    expect(
      checkSourceRunInvariants({
        status: "OK",
        fetched: 1,
        newItems: 0,
        duplicates: 0,
        durationMs: -1,
        error: "boom",
      })
    ).toHaveLength(2);
  });

  it("assertNoViolations lanza con el detalle", () => {
    expect(() => assertNoViolations("Post", ["a", "b"])).toThrow(
      /Invariantes de Post: a; b/
    );
    expect(() => assertNoViolations("Post", [])).not.toThrow();
  });
});
