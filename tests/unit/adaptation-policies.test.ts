import { describe, expect, it } from "vitest";
import {
  canAutoPublish,
  isPushOnlySource,
  publishedAtFor,
  resolvePublicationStatus,
  shouldAlertOnFailure,
} from "@/lib/adaptation/policies";

describe("resolvePublicationStatus", () => {
  it("publica directo con autopublish", () => {
    expect(resolvePublicationStatus(true)).toBe("PUBLISHED");
  });

  it("deja en borrador sin autopublish", () => {
    expect(resolvePublicationStatus(false)).toBe("DRAFT");
  });
});

describe("publishedAtFor", () => {
  const now = new Date("2026-11-11T12:00:00.000Z");

  it("asigna fecha solo a PUBLISHED", () => {
    expect(publishedAtFor("PUBLISHED", now)).toBe(now);
    expect(publishedAtFor("DRAFT", now)).toBeNull();
    expect(publishedAtFor("REJECTED", now)).toBeNull();
  });
});

describe("shouldAlertOnFailure", () => {
  it("dispara exactamente al cruzar el umbral", () => {
    expect(shouldAlertOnFailure(3, 3)).toBe(true);
    expect(shouldAlertOnFailure(2, 3)).toBe(false);
    expect(shouldAlertOnFailure(4, 3)).toBe(false);
  });

  it("ignora umbrales no positivos", () => {
    expect(shouldAlertOnFailure(0, 0)).toBe(false);
  });
});

describe("helpers de fuente", () => {
  it("canAutoPublish refleja la bandera", () => {
    expect(canAutoPublish({ autopublish: true })).toBe(true);
    expect(canAutoPublish({ autopublish: false })).toBe(false);
  });

  it("WHATSAPP es push-only", () => {
    expect(isPushOnlySource("WHATSAPP")).toBe(true);
    expect(isPushOnlySource("WEB")).toBe(false);
  });
});
