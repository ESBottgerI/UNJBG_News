import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getClientIp,
  getClientIpFromHeaders,
  rateLimit,
  resetRateLimit,
} from "@/lib/rate-limit";

let keySeq = 0;
function key(prefix = "test"): string {
  keySeq += 1;
  return `${prefix}-${Date.now()}-${keySeq}`;
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite hasta el limite y luego bloquea", () => {
    const k = key();
    const first = rateLimit({ key: k, limit: 2, windowMs: 60_000 });
    expect(first.ok).toBe(true);
    expect(first.remaining).toBe(1);

    const second = rateLimit({ key: k, limit: 2, windowMs: 60_000 });
    expect(second.ok).toBe(true);
    expect(second.remaining).toBe(0);

    const third = rateLimit({ key: k, limit: 2, windowMs: 60_000 });
    expect(third.ok).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reinicia el contador al vencer la ventana", () => {
    const k = key();
    rateLimit({ key: k, limit: 1, windowMs: 1_000 });
    expect(rateLimit({ key: k, limit: 1, windowMs: 1_000 }).ok).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(rateLimit({ key: k, limit: 1, windowMs: 1_000 }).ok).toBe(true);
  });

  it("resetRateLimit libera el cupo", () => {
    const k = key();
    rateLimit({ key: k, limit: 1, windowMs: 60_000 });
    expect(rateLimit({ key: k, limit: 1, windowMs: 60_000 }).ok).toBe(false);

    resetRateLimit(k);
    expect(rateLimit({ key: k, limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });

  it("claves distintas tienen contadores independientes", () => {
    const a = key("a");
    const b = key("b");
    rateLimit({ key: a, limit: 1, windowMs: 60_000 });
    expect(rateLimit({ key: a, limit: 1, windowMs: 60_000 }).ok).toBe(false);
    expect(rateLimit({ key: b, limit: 1, windowMs: 60_000 }).ok).toBe(true);
  });
});

describe("getClientIpFromHeaders", () => {
  it("toma la primera IP de X-Forwarded-For", () => {
    const headers = {
      get: (name: string) =>
        name === "x-forwarded-for" ? "203.0.113.9, 10.0.0.1" : null,
    };
    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("usa X-Real-IP como respaldo", () => {
    const headers = {
      get: (name: string) => (name === "x-real-ip" ? "198.51.100.4" : null),
    };
    expect(getClientIpFromHeaders(headers)).toBe("198.51.100.4");
  });

  it("devuelve 'desconocida' sin cabeceras", () => {
    expect(getClientIpFromHeaders({ get: () => null })).toBe("desconocida");
  });

  it("lee la IP desde un Request", () => {
    const request = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "192.0.2.1" },
    });
    expect(getClientIp(request)).toBe("192.0.2.1");
  });
});
