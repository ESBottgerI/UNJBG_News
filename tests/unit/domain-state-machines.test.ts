import { describe, expect, it } from "vitest";
import {
  assertPostTransition,
  assertRawItemTransition,
  canTransitionPost,
  canTransitionRawItem,
  canTransitionSource,
  isFinalIngestStatus,
  isPublished,
  isSourcePollable,
} from "@/lib/domain/state-machines";

describe("RawItem state machine", () => {
  it("permite NEW -> PROCESSED y NEW -> DISCARDED", () => {
    expect(canTransitionRawItem("NEW", "PROCESSED")).toBe(true);
    expect(canTransitionRawItem("NEW", "DISCARDED")).toBe(true);
  });

  it("trata PROCESSED y DISCARDED como finales", () => {
    expect(canTransitionRawItem("PROCESSED", "NEW")).toBe(false);
    expect(canTransitionRawItem("DISCARDED", "PROCESSED")).toBe(false);
    expect(isFinalIngestStatus("PROCESSED")).toBe(true);
    expect(isFinalIngestStatus("NEW")).toBe(false);
  });

  it("lanza un error explicito en transiciones invalidas", () => {
    expect(() => assertRawItemTransition("DISCARDED", "PROCESSED")).toThrow(
      /Transicion invalida de RawItem/
    );
  });
});

describe("Post state machine", () => {
  it("permite cualquier cambio editorial", () => {
    expect(canTransitionPost("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionPost("PUBLISHED", "REJECTED")).toBe(true);
    expect(canTransitionPost("REJECTED", "DRAFT")).toBe(true);
  });

  it("permite la transicion idempotente", () => {
    expect(canTransitionPost("DRAFT", "DRAFT")).toBe(true);
  });

  it("expone el predicado de publicacion", () => {
    expect(isPublished("PUBLISHED")).toBe(true);
    expect(isPublished("DRAFT")).toBe(false);
  });

  it("lanza un error en una transicion invalida", () => {
    expect(() =>
      assertPostTransition("DRAFT", "INVALID" as never)
    ).toThrow(/Transicion invalida de Post/);
  });
});

describe("Source state machine", () => {
  it("permite activar, pausar y deshabilitar", () => {
    expect(canTransitionSource("ACTIVE", "PAUSED")).toBe(true);
    expect(canTransitionSource("PAUSED", "DISABLED")).toBe(true);
    expect(canTransitionSource("DISABLED", "ACTIVE")).toBe(true);
  });

  it("solo ACTIVE es pollable", () => {
    expect(isSourcePollable("ACTIVE")).toBe(true);
    expect(isSourcePollable("PAUSED")).toBe(false);
  });
});
