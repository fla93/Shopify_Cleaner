import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseImportFile, computeFinalStatus } from "./excel";

// ─── Helper: crea un Buffer Excel da un array di righe ────────────────────────
function makeExcelBuffer(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── parseImportFile ──────────────────────────────────────────────────────────

describe("parseImportFile", () => {
  it("legge correttamente una riga base", () => {
    const buf = makeExcelBuffer([
      {
        SKU: "ABC001",
        "Product Name": "Anello Pandora",
        Brand: "Pandora",
        Category: "Anelli",
        "Image URL": "https://example.com/img.jpg",
        "Theoretical Qty": 3,
      },
    ]);

    const result = parseImportFile(buf);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: "ABC001",
      name: "Anello Pandora",
      brand: "Pandora",
      category: "Anelli",
      theoreticalQty: 3,
    });
  });

  it("legge il brand dalla colonna 'Brand/Vendor' (formato Shopify)", () => {
    const buf = makeExcelBuffer([
      {
        SKU: "P001",
        "Product Name": "Bracciale Pandora",
        "Brand/Vendor": "Pandora",
        Category: "Bracciali",
        "Image URL": "",
        "Theoretical Qty": 1,
      },
    ]);

    const result = parseImportFile(buf);

    expect(result[0].brand).toBe("Pandora");
  });

  it("legge il brand dalla colonna 'Vendor' come fallback", () => {
    const buf = makeExcelBuffer([
      {
        SKU: "V001",
        "Product Name": "Orologio Casio",
        Vendor: "Casio",
        Category: "Orologi",
        "Image URL": "",
        "Theoretical Qty": 2,
      },
    ]);

    const result = parseImportFile(buf);

    expect(result[0].brand).toBe("Casio");
  });

  it("salta le righe senza SKU", () => {
    const buf = makeExcelBuffer([
      { SKU: "OK001", "Product Name": "Prodotto A", Brand: "Amen", Category: "Anelli", "Image URL": "", "Theoretical Qty": 1 },
      { SKU: "", "Product Name": "Prodotto senza SKU", Brand: "Amen", Category: "Anelli", "Image URL": "", "Theoretical Qty": 1 },
    ]);

    const result = parseImportFile(buf);

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe("OK001");
  });

  it("gestisce Theoretical Qty mancante come 0", () => {
    const buf = makeExcelBuffer([
      { SKU: "X001", "Product Name": "Test", Brand: "Casio", Category: "Orologi", "Image URL": "" },
    ]);

    const result = parseImportFile(buf);

    expect(result[0].theoreticalQty).toBe(0);
  });

  it("trimma gli spazi dai valori", () => {
    const buf = makeExcelBuffer([
      {
        SKU: "  T001  ",
        "Product Name": "  Nome con spazi  ",
        Brand: "  Pandora  ",
        Category: "  Anelli  ",
        "Image URL": "",
        "Theoretical Qty": 1,
      },
    ]);

    const result = parseImportFile(buf);

    expect(result[0].sku).toBe("T001");
    expect(result[0].name).toBe("Nome con spazi");
    expect(result[0].brand).toBe("Pandora");
  });

  it("importa più righe con brand diversi", () => {
    const buf = makeExcelBuffer([
      { SKU: "P001", "Product Name": "Charm", "Brand/Vendor": "Pandora", Category: "Charm", "Image URL": "", "Theoretical Qty": 5 },
      { SKU: "C001", "Product Name": "Orologio", "Brand/Vendor": "Casio", Category: "Orologi", "Image URL": "", "Theoretical Qty": 2 },
      { SKU: "T001", "Product Name": "Watch", "Brand/Vendor": "Tissot", Category: "Orologi", "Image URL": "", "Theoretical Qty": 1 },
    ]);

    const result = parseImportFile(buf);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.brand)).toEqual(["Pandora", "Casio", "Tissot"]);
  });
});

// ─── computeFinalStatus ───────────────────────────────────────────────────────

describe("computeFinalStatus", () => {
  it("NON VERIFICATO se nessun negozio ha verificato", () => {
    const result = computeFinalStatus([], 5);
    expect(result).toBe("NON VERIFICATO");
  });

  it("NON VERIFICATO se tutti SKIPPED", () => {
    const result = computeFinalStatus(
      [{ status: "SKIPPED", detectedQty: null }, { status: "SKIPPED", detectedQty: null }],
      5
    );
    expect(result).toBe("NON VERIFICATO");
  });

  it("DISPONIBILE se tutti i negozi trovano il prodotto con quantità corretta", () => {
    const result = computeFinalStatus(
      [
        { status: "PRESENT", detectedQty: 3 },
        { status: "PRESENT", detectedQty: 3 },
      ],
      3
    );
    expect(result).toBe("DISPONIBILE");
  });

  it("DISPONIBILE se trovato ma senza quantità inserita", () => {
    const result = computeFinalStatus(
      [{ status: "PRESENT", detectedQty: null }],
      5
    );
    expect(result).toBe("DISPONIBILE");
  });

  it("NON TROVATO se nessun negozio lo trova", () => {
    const result = computeFinalStatus(
      [
        { status: "NOT_PRESENT", detectedQty: null },
        { status: "NOT_PRESENT", detectedQty: null },
      ],
      5
    );
    expect(result).toBe("NON TROVATO");
  });

  it("DISCREPANZA se trovato ma quantità sbagliata", () => {
    const result = computeFinalStatus(
      [{ status: "PRESENT", detectedQty: 2 }],
      5
    );
    expect(result).toBe("DISCREPANZA");
  });

  it("DA RICONTROLLARE se risultati misti (un negozio sì, uno no)", () => {
    const result = computeFinalStatus(
      [
        { status: "PRESENT", detectedQty: 3 },
        { status: "NOT_PRESENT", detectedQty: null },
      ],
      3
    );
    expect(result).toBe("DA RICONTROLLARE");
  });

  it("DA RICONTROLLARE se almeno un negozio restituisce NOT_SURE", () => {
    const result = computeFinalStatus(
      [
        { status: "PRESENT", detectedQty: 3 },
        { status: "NOT_SURE", detectedQty: null },
      ],
      3
    );
    expect(result).toBe("DA RICONTROLLARE");
  });
});
