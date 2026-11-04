import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Tests de integracion: usan Postgres real (base *_test) y corren en serie
// para que el TRUNCATE entre tests no pise a otro archivo.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/integration.ts"],
    pool: "forks",
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    clearMocks: true,
    restoreMocks: true,
  },
});
