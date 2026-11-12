import { describe, expect, it } from "vitest";
import {
  ADAPTER_REGISTRY,
  INGESTIBLE_TYPES,
  getAdapterMetadata,
  isIngestibleType,
  isPullType,
} from "@/lib/adapters/registry";

describe("ADAPTER_REGISTRY", () => {
  it("cubre todos los tipos de fuente", () => {
    expect(Object.keys(ADAPTER_REGISTRY).sort()).toEqual([
      "FACEBOOK",
      "RSS",
      "WEB",
      "WHATSAPP",
    ]);
  });

  it("WHATSAPP es push-only y no ingestible", () => {
    const meta = getAdapterMetadata("WHATSAPP");
    expect(meta.ingestible).toBe(false);
    expect(meta.pull).toBe(false);
    expect(meta.adapter).toBe("whatsapp-worker");
  });
});

describe("INGESTIBLE_TYPES", () => {
  it("mantiene el orden y excluye WHATSAPP", () => {
    expect(INGESTIBLE_TYPES).toEqual(["WEB", "RSS", "FACEBOOK"]);
  });

  it("coincide con los metadatos", () => {
    for (const type of INGESTIBLE_TYPES) {
      expect(isIngestibleType(type)).toBe(true);
      expect(isPullType(type)).toBe(true);
    }
    expect(isIngestibleType("WHATSAPP")).toBe(false);
  });
});
