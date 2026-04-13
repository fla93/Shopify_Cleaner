/**
 * Test di integrazione API — chiamate HTTP dirette senza browser.
 *
 * Progetti:
 *  - api-admin: /api/products, /api/stats, /api/import  (admin, nessun storeId richiesto)
 *  - api-clerk: /api/verifications                      (clerk, storeId obbligatorio)
 *
 * I describe block con test.use({ storageState }) selezionano automaticamente
 * le credenziali giuste in base al progetto attivo.
 */

import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── GET /api/products ────────────────────────────────────────────────────────

test.describe("GET /api/products", () => {
  test("ritorna 200 con lista prodotti", async ({ request }) => {
    const res = await request.get("/api/products?page=1&pageSize=10");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("products");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.products)).toBe(true);
  });

  test("filtra per brand 'Pandora' — ritorna solo prodotti Pandora", async ({ request }) => {
    const res = await request.get("/api/products?page=1&pageSize=50&brand=Pandora");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.products.length).toBeGreaterThan(0);
    for (const p of data.products) {
      expect(p.brand?.toLowerCase()).toBe("pandora");
    }
  });

  test("filtra per brand 'Casio' — ritorna solo prodotti Casio", async ({ request }) => {
    const res = await request.get("/api/products?page=1&pageSize=50&brand=Casio");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.products.length).toBeGreaterThan(0);
    for (const p of data.products) {
      expect(p.brand?.toLowerCase()).toBe("casio");
    }
  });

  test("brand inesistente — ritorna lista vuota", async ({ request }) => {
    const res = await request.get("/api/products?page=1&pageSize=10&brand=BrandChENonEsiste");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(0);
    expect(data.products).toHaveLength(0);
  });

  test("paginazione funziona — page 2 con pageSize 2", async ({ request }) => {
    const page1 = await (await request.get("/api/products?page=1&pageSize=2")).json();
    const page2 = await (await request.get("/api/products?page=2&pageSize=2")).json();
    // I prodotti delle due pagine devono essere diversi
    const ids1 = page1.products.map((p: any) => p.id);
    const ids2 = page2.products.map((p: any) => p.id);
    const overlap = ids1.filter((id: number) => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  });

  test("senza autenticazione ritorna 401", async ({ playwright }) => {
    // Crea un context fresco senza cookies/storageState
    const context = await playwright.request.newContext({ baseURL: "http://localhost:3000" });
    const res = await context.get("/api/products");
    await context.dispose();
    // NextAuth risponde 401 o redirect — non deve essere 200
    expect(res.status()).not.toBe(200);
  });
});

// ─── GET /api/stats ───────────────────────────────────────────────────────────

test.describe("GET /api/stats", () => {
  test("ritorna statistiche con i campi corretti", async ({ request }) => {
    const res = await request.get("/api/stats");
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("totalProducts");
    expect(data).toHaveProperty("verifiedProducts");
    expect(data).toHaveProperty("completionPercent");
    expect(data).toHaveProperty("byStore");
    expect(data.totalProducts).toBeGreaterThanOrEqual(5);
  });
});

// ─── POST /api/verifications ─────────────────────────────────────────────────
// Richiedono storeId → girano solo nel progetto api-clerk

test.describe("POST /api/verifications", () => {
  test.use({ storageState: "tests/.auth/clerk.json" });
  test("crea una verifica PRESENT per un prodotto di test", async ({ request }) => {
    // Trova il prodotto TEST-P001
    const product = await prisma.product.findUnique({ where: { sku: "TEST-P001" } });
    expect(product).not.toBeNull();

    const res = await request.post("/api/verifications", {
      data: {
        productId: product!.id,
        status: "PRESENT",
        detectedQty: 2,
        note: "Test automatico",
      },
    });

    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("PRESENT");
    expect(data.detectedQty).toBe(2);
    expect(data.note).toBe("Test automatico");
  });

  test("crea una verifica NOT_PRESENT", async ({ request }) => {
    const product = await prisma.product.findUnique({ where: { sku: "TEST-C001" } });
    const res = await request.post("/api/verifications", {
      data: { productId: product!.id, status: "NOT_PRESENT" },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("NOT_PRESENT");
  });

  test("ritorna 400 con status non valido", async ({ request }) => {
    const product = await prisma.product.findUnique({ where: { sku: "TEST-P001" } });
    const res = await request.post("/api/verifications", {
      data: { productId: product!.id, status: "STATO_INVENTATO" },
    });
    expect(res.status()).toBe(400);
  });

  test("ritorna 404 con productId inesistente", async ({ request }) => {
    const res = await request.post("/api/verifications", {
      data: { productId: 999999, status: "PRESENT" },
    });
    expect(res.status()).toBe(404);
  });
});

// ─── GET /api/verifications ───────────────────────────────────────────────────

test.describe("GET /api/verifications", () => {
  test.use({ storageState: "tests/.auth/clerk.json" });
  test("ritorna la verifica esistente per un prodotto", async ({ request }) => {
    const product = await prisma.product.findUnique({ where: { sku: "TEST-P001" } });
    const res = await request.get(`/api/verifications?productId=${product!.id}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    // Può essere null (nessuna verifica) o un oggetto con status
    if (data !== null) {
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("id");
    }
  });

  test("ritorna 400 senza productId", async ({ request }) => {
    const res = await request.get("/api/verifications");
    expect(res.status()).toBe(400);
  });
});

// ─── PATCH /api/verifications ─────────────────────────────────────────────────

test.describe("PATCH /api/verifications", () => {
  test.use({ storageState: "tests/.auth/clerk.json" });
  test("aggiorna una verifica esistente", async ({ request }) => {
    // Prima crea una verifica
    const product = await prisma.product.findUnique({ where: { sku: "TEST-P002" } });
    const createRes = await request.post("/api/verifications", {
      data: { productId: product!.id, status: "PRESENT", detectedQty: 1 },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // Poi aggiornala
    const patchRes = await request.patch("/api/verifications", {
      data: { id: created.id, status: "NOT_PRESENT", detectedQty: null, note: "Corretto" },
    });
    expect(patchRes.status()).toBe(200);
    const updated = await patchRes.json();
    expect(updated.status).toBe("NOT_PRESENT");
    expect(updated.note).toBe("Corretto");
  });

  test("ritorna 404 con id inesistente", async ({ request }) => {
    const res = await request.patch("/api/verifications", {
      data: { id: 999999, status: "PRESENT" },
    });
    expect(res.status()).toBe(404);
  });
});

// ─── POST /api/import ─────────────────────────────────────────────────────────

test.describe("POST /api/import", () => {
  // Richiede ruolo ADMIN — forza admin auth anche nel progetto api-clerk
  test.use({ storageState: "tests/.auth/admin.json" });
  test("importa prodotti da un Excel valido", async ({ request }) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { SKU: "TEST-API001", "Product Name": "Prod API Test 1", "Brand/Vendor": "Pandora", Category: "Charm",   "Image URL": "", "Theoretical Qty": 1 },
      { SKU: "TEST-API002", "Product Name": "Prod API Test 2", "Brand/Vendor": "Casio",   Category: "Orologi", "Image URL": "", "Theoretical Qty": 2 },
    ]), "Sheet1");
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

    const res = await request.post("/api/import", {
      multipart: {
        file: { name: "test.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer },
      },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("imported");
    expect(data).toHaveProperty("updated");
    expect(data.imported + data.updated).toBe(2);
  });

  test("i brand sono salvati correttamente (colonna Brand/Vendor)", async ({ request }) => {
    // Importa un prodotto con colonna "Brand/Vendor"
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { SKU: "TEST-BRAND001", "Product Name": "Brand Test", "Brand/Vendor": "Tissot", Category: "Orologi", "Image URL": "", "Theoretical Qty": 1 },
    ]), "Sheet1");
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    await request.post("/api/import", {
      multipart: {
        file: { name: "brand_test.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer },
      },
    });

    // Verifica che il brand sia stato salvato correttamente
    const product = await prisma.product.findUnique({ where: { sku: "TEST-BRAND001" } });
    expect(product?.brand).toBe("Tissot");
  });

  test("ritorna errore con file non Excel", async ({ request }) => {
    const res = await request.post("/api/import", {
      multipart: {
        file: { name: "test.txt", mimeType: "text/plain", buffer: Buffer.from("non è un excel") },
      },
    });
    expect(res.status()).not.toBe(200);
  });
});
