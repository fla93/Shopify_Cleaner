/**
 * Test E2E — flussi clerk:
 *  - Survey carica i prodotti
 *  - Filtro brand funziona
 *  - Verifica prodotto (PRESENT / NOT_PRESENT)
 *  - Torna indietro e modifica verifica
 */

import { test, expect } from "@playwright/test";

test.describe("Clerk — Survey", () => {
  test("viene reindirizzato a /survey dopo login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/survey", { timeout: 8000 });
  });

  test("mostra il filtro brand con la lista dei brand", async ({ page }) => {
    await page.goto("/survey");
    const brandSelect = page.locator("select").first();
    await expect(brandSelect).toBeVisible({ timeout: 8000 });

    // Verifica che ci siano opzioni nel dropdown
    const options = await brandSelect.locator("option").count();
    expect(options).toBeGreaterThan(1);

    // Verifica che "Pandora" sia tra le opzioni
    await expect(brandSelect.locator('option[value="Pandora"]')).toBeAttached();
  });

  test("filtro per brand 'Pandora' mostra solo prodotti Pandora", async ({ page }) => {
    await page.goto("/survey");
    await page.waitForLoadState("networkidle");

    const brandSelect = page.locator("select").first();

    // Aspetta la risposta API con brand=Pandora prima di controllare la UI
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/products") && r.url().includes("brand=Pandora"),
      { timeout: 15000 }
    );
    await brandSelect.selectOption("Pandora");
    await responsePromise;

    // Attendi che il brand nella scheda prodotto mostri "Pandora"
    // (evita di matchare l'<option> nel dropdown, che non è "visible")
    await expect(page.locator("p.text-sm.text-gray-500").filter({ hasText: "Pandora" })).toBeVisible({ timeout: 8000 });
  });

  test("verifica prodotto come PRESENT e avanza al successivo", async ({ page }) => {
    await page.goto("/survey");
    await page.waitForLoadState("networkidle");

    // Leggi il prodotto corrente (counter "X / Y")
    const counter = page.locator(".font-bold.text-indigo-600").first();
    const before = await counter.innerText();

    // Clicca Present
    await page.locator('button:has-text("Present")').click();
    // Inserisci quantità
    await page.locator('input[type="number"]').fill("2");
    // Conferma
    await page.locator('button:has-text("Confirm")').click();

    // Attendi avanzamento
    await page.waitForTimeout(1500);
    const after = await counter.innerText();

    // L'indice deve essere avanzato (o siamo arrivati a "Survey Complete!")
    const isComplete = await page.locator("text=Survey Complete").isVisible();
    if (!isComplete) {
      expect(after).not.toBe(before);
    }
  });

  test("verifica prodotto come NOT_PRESENT e avanza", async ({ page }) => {
    await page.goto("/survey");
    await page.waitForLoadState("networkidle");

    const counter = page.locator(".font-bold.text-indigo-600").first();
    const before = await counter.innerText();

    await page.locator('button:has-text("Not Found")').click();
    await page.locator('button:has-text("Confirm")').click();

    await page.waitForTimeout(1500);

    const isComplete = await page.locator("text=Survey Complete").isVisible();
    if (!isComplete) {
      const after = await counter.innerText();
      expect(after).not.toBe(before);
    }
  });

  test("bottone ← indietro è disabilitato sul primo prodotto", async ({ page }) => {
    await page.goto("/survey");
    await page.waitForLoadState("networkidle");

    const backBtn = page.locator('button[title="Prodotto precedente"]');
    await expect(backBtn).toBeVisible({ timeout: 8000 });
    await expect(backBtn).toBeDisabled();
  });

  test("torna indietro dopo una verifica e mostra dati pre-popolati", async ({ page }) => {
    await page.goto("/survey");
    await page.waitForLoadState("networkidle");

    // Leggi il totale iniziale per costruire il pattern atteso dopo l'avanzamento
    const counter = page.locator(".font-bold.text-indigo-600").first();
    const initialText = await counter.innerText();
    const total = initialText.split("/")[1]?.trim() ?? "\\d+";

    // Verifica il primo prodotto
    await page.locator('button:has-text("Present")').click();
    await page.locator('input[type="number"]').fill("3");
    await page.locator('button:has-text("Confirm")').click();

    // Aspetta che il contatore avanzi a "2 / X" (più robusto di waitForTimeout)
    await expect(counter).toHaveText(new RegExp(`2\\s*/\\s*${total}`), { timeout: 10000 });

    // Ora torna indietro
    const backBtn = page.locator('button[title="Prodotto precedente"]');
    await expect(backBtn).toBeEnabled({ timeout: 5000 });
    await backBtn.click();

    // Deve mostrare il banner "Stai modificando"
    await expect(page.locator("text=Stai modificando una verifica già salvata")).toBeVisible({ timeout: 5000 });

    // Il form deve essere pre-popolato con lo status precedente
    // Attendi che il fetch della verifica completi e aggiorni il pulsante
    const presentBtn = page.locator('button:has-text("Present")');
    await expect(presentBtn).toHaveClass(/bg-green-500/, { timeout: 8000 });
  });

  test("schermata 'Survey Complete' mostra bottone 'Rivedi verifiche'", async ({ page }) => {
    // Questo test verifica solo la schermata done se viene raggiunta
    // Usiamo un filtro brand per limitare i prodotti
    await page.goto("/survey");
    await page.waitForLoadState("networkidle");

    // Filtro per un brand e verifica tutti i prodotti uno a uno
    const brandSelect = page.locator("select").first();
    await brandSelect.selectOption("Casio");
    await page.waitForTimeout(1000);

    // Verifica tutti i prodotti Casio finché non arrivi a Survey Complete
    let iterations = 0;
    while (iterations < 20) {
      const isComplete = await page.locator("text=Survey Complete").isVisible();
      if (isComplete) break;

      const hasProduct = await page.locator('button:has-text("Present")').isVisible();
      if (!hasProduct) break;

      await page.locator('button:has-text("Present")').click();
      await page.locator('button:has-text("Confirm")').click();
      await page.waitForTimeout(1000);
      iterations++;
    }

    const isComplete = await page.locator("text=Survey Complete").isVisible();
    if (isComplete) {
      await expect(page.locator("text=Rivedi verifiche")).toBeVisible();
    }
  });
});
