import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  // PGlite (base PostgreSQL en mémoire) met parfois plus de 10 s à démarrer quand tous les tests tournent en parallèle.
  test: { environment: "node", include: ["src/**/*.test.ts"], hookTimeout: 60_000, testTimeout: 30_000 },
});
