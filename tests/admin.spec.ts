/**
 * Test E2E — flussi admin:
 *  - Dashboard carica con statistiche
 *  - Import Excel funziona
 *  - Report scaricabile
 */

import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";

test.describe("Admin — Dashboard", () => {
  test("mostra la dashboard dopo login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Dashboard")).toBeVisible();
    await expect(page.getByText("Import Products")).toBeVisible();
    await expect(page.getByText("Download Report")).toBeVisible();
  });

  test("mostra i prodotti totali nelle statistiche", async ({ page }) => {
    await page.goto("/");
    // Aspetta che le stat vengano caricate (devono esserci almeno i 5 prodotti di test)
    await expect(page.getByText("Total Products")).toBeVisible({ timeout: 8000 });
    const card = page.locator(".card").filter({ hasText: "Total Products" });
    const number = await card.locator(".text-2xl.font-bold").innerText();
    expect(parseInt(number)).toBeGreaterThanOrEqual(5);
  });
});

test.describe("Admin — Import Excel", () => {
  // Il <input type="file" hidden> non scatena il onChange sintetico di React
  // tramite setInputFiles in headless mode → testiamo l'API direttamente.

  test("la pagina import è accessibile e mostra il form", async ({ page }) => {
    await page.goto("/admin/import");
    // Usa getByRole per evitare match multiplo con il <button> "Import Products"
    await expect(page.getByRole("heading", { name: "Import Products" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Expected Excel Format" })).toBeVisible();
    await expect(page.locator("#file-upload")).toBeAttached();
  });

  test("import via API crea nuovi prodotti (Brand/Vendor)", async ({ request }) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { SKU: "TEST-IMP001", "Product Name": "Prodotto Import Test 1", "Brand/Vendor": "Pandora", Category: "Charm",   "Image URL": "", "Theoretical Qty": 1 },
      { SKU: "TEST-IMP002", "Product Name": "Prodotto Import Test 2", "Brand/Vendor": "Casio",   Category: "Orologi", "Image URL": "", "Theoretical Qty": 2 },
    ]), "Sheet1");
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    const res = await request.post("/api/import", {
      multipart: {
        file: { name: "test.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer },
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.imported + data.updated).toBe(2);
  });
});

test.describe("Admin — Report", () => {
  test("pagina report è accessibile", async ({ page }) => {
    await page.goto("/admin/report");
    await expect(page.getByText("Download Report")).toBeVisible();
  });

  test("download report genera un file", async ({ page }) => {
    await page.goto("/admin/report");
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.click('button:has-text("Download")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  });
});
