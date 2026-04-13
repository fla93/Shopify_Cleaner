/**
 * Esegue il login come admin e come clerk e salva le sessioni in
 * tests/.auth/admin.json e tests/.auth/clerk.json.
 * Gli altri test riusano queste sessioni senza dover fare login.
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

const ADMIN_AUTH = path.join(__dirname, ".auth/admin.json");
const CLERK_AUTH  = path.join(__dirname, ".auth/clerk.json");

setup("login admin", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "admin@shopifycleaner.com");
  await page.fill("#password", "admin123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/", { timeout: 10000 });
  await page.context().storageState({ path: ADMIN_AUTH });
});

setup("login clerk (Colli)", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "colli@shopifycleaner.com");
  await page.fill("#password", "clerk123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/survey", { timeout: 10000 });
  await page.context().storageState({ path: CLERK_AUTH });
});
