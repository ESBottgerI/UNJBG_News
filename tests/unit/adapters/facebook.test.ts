import { beforeEach, describe, expect, it, vi } from "vitest";
import { FacebookAdapter } from "@/adapters/facebook";
import { makeSource } from "../../helpers/sources";

// No se abre Chromium: los rechazos tempranos ocurren antes de tocar el
// navegador. La navegacion real se cubre en los E2E/CI con fuentes mockeadas.

describe("FacebookAdapter (validaciones tempranas)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rechaza grupos privados", async () => {
    const adapter = new FacebookAdapter(
      makeSource({ type: "FACEBOOK", config: { privateGroup: true } })
    );
    await expect(adapter.fetchItems()).rejects.toThrow(/grupo privado/i);
  });

  it("exige URL de la pagina", async () => {
    const adapter = new FacebookAdapter(
      makeSource({ type: "FACEBOOK", url: null })
    );
    await expect(adapter.fetchItems()).rejects.toThrow(/sin url/i);
  });
});
