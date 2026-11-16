import { defineConfig } from "@playwright/test";

// Tests navigateur (npm run test:e2e). Aucun service réel : le site est construit puis lancé en local sur le port 3100,
// et branché sur un faux Supabase en mémoire (e2e/mock-supabase.ts). Aucune clé réelle, aucun Stripe.
const PORT = 3100;
const env = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54399",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "cle-anonyme-de-test",
  SUPABASE_SERVICE_ROLE_KEY: "cle-service-de-test",
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 2,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR", trace: "off" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/connexion`,
    timeout: 600_000,
    reuseExistingServer: !process.env.CI,
    env,
  },
});
