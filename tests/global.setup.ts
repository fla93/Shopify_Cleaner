/**
 * Esegue prima di tutti i test Playwright.
 * Inserisce prodotti di test nel DB reale (SKU "TEST-*") e li ripulisce
 * alla fine. NON tocca prodotti o verifiche esistenti.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function globalSetup() {
  console.log("\n🔧 Global setup: inserimento prodotti di test...");

  // Pulizia prodotti di test precedenti
  await prisma.verification.deleteMany({
    where: { product: { sku: { startsWith: "TEST-" } } },
  });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "TEST-" } } });

  // Inserimento prodotti di test (2 brand: Pandora e Casio)
  await prisma.product.createMany({
    data: [
      { sku: "TEST-P001", name: "Charm Cuore Pandora", brand: "Pandora", category: "Charm", theoreticalQty: 2 },
      { sku: "TEST-P002", name: "Bracciale Moments Pandora", brand: "Pandora", category: "Bracciali", theoreticalQty: 1 },
      { sku: "TEST-P003", name: "Ciondolo Pandora Rose", brand: "Pandora", category: "Ciondoli e Pendenti", theoreticalQty: 3 },
      { sku: "TEST-C001", name: "Orologio Casio G-Shock", brand: "Casio", category: "Orologi", theoreticalQty: 1 },
      { sku: "TEST-C002", name: "Orologio Casio Edifice", brand: "Casio", category: "Orologi", theoreticalQty: 2 },
    ],
  });

  console.log("✅ 5 prodotti di test inseriti (3 Pandora, 2 Casio)\n");

  await prisma.$disconnect();
}

export default globalSetup;
