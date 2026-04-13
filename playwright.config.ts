import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["html", { open: "never" }], ["line"]],
  globalSetup: "./tests/global.setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // 1. Salva le sessioni di login
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // 2. Test admin (usa sessione admin)
    {
      name: "admin",
      dependencies: ["setup"],
      testMatch: /admin\.spec\.ts/,
      use: { storageState: "tests/.auth/admin.json" },
    },
    // 3. Test clerk (usa sessione clerk)
    {
      name: "clerk",
      dependencies: ["setup"],
      testMatch: /clerk\.spec\.ts/,
      use: { storageState: "tests/.auth/clerk.json" },
    },
    // 4. Test API admin (stats, import) — usa sessione admin
    {
      name: "api-admin",
      dependencies: ["setup"],
      testMatch: /api\.spec\.ts/,
      use: { storageState: "tests/.auth/admin.json" },
    },
    // 5. Test API clerk (verifications) — usa sessione clerk con storeId
    {
      name: "api-clerk",
      dependencies: ["setup"],
      testMatch: /api\.spec\.ts/,
      use: { storageState: "tests/.auth/clerk.json" },
    },
  ],
  webServer: {
    command: "npm run dev:local",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
