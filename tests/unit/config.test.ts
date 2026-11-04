import { afterEach, describe, expect, it } from "vitest";
import { envBool, envInt } from "@/lib/config";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("envInt", () => {
  it("usa el valor por defecto si la variable no existe", () => {
    delete process.env.TEST_ENV_INT;
    expect(envInt("TEST_ENV_INT", 7)).toBe(7);
  });

  it("lee enteros positivos", () => {
    process.env.TEST_ENV_INT = "12";
    expect(envInt("TEST_ENV_INT", 7)).toBe(12);
  });

  it("trunca decimales y descarta valores invalidos", () => {
    process.env.TEST_ENV_INT = "3.9";
    expect(envInt("TEST_ENV_INT", 7)).toBe(3);
    process.env.TEST_ENV_INT = "abc";
    expect(envInt("TEST_ENV_INT", 7)).toBe(7);
    process.env.TEST_ENV_INT = "-1";
    expect(envInt("TEST_ENV_INT", 7)).toBe(7);
    process.env.TEST_ENV_INT = "0";
    expect(envInt("TEST_ENV_INT", 7)).toBe(7);
  });
});

describe("envBool", () => {
  it("usa el valor por defecto si no existe", () => {
    delete process.env.TEST_ENV_BOOL;
    expect(envBool("TEST_ENV_BOOL", true)).toBe(true);
    expect(envBool("TEST_ENV_BOOL", false)).toBe(false);
  });

  it("interpreta valores falsy conocidos", () => {
    for (const raw of ["false", "0", "off", "no", " OFF "]) {
      process.env.TEST_ENV_BOOL = raw;
      expect(envBool("TEST_ENV_BOOL", true)).toBe(false);
    }
  });

  it("cualquier otro valor es verdadero", () => {
    for (const raw of ["true", "1", "si", "yes"]) {
      process.env.TEST_ENV_BOOL = raw;
      expect(envBool("TEST_ENV_BOOL", false)).toBe(true);
    }
  });
});
