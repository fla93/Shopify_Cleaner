/**
 * Excel utilities:
 *  - parseImportFile: parse uploaded Excel for product import
 *  - generateReport: build the inventory report Excel workbook
 */

import * as XLSX from "xlsx";
import { ProductRow, ReportRow } from "../types";

// ─── Import Parsing ────────────────────────────────────────────────────────────

/**
 * Parse a Buffer (from the uploaded .xlsx / .xls file) into product rows.
 * Expected columns (case-insensitive, order doesn't matter):
 *   SKU | Product Name | Brand | Category | Image URL | Theoretical Qty
 */
export function parseImportFile(buffer: Buffer): ProductRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array-of-objects; header row becomes keys
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false, // parse all as strings first
  });

  const products: ProductRow[] = raw
    .map((row, index) => {
      // Normalise keys to lowercase + trim
      const normalised: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        normalised[k.toLowerCase().trim()] = String(v).trim();
      }

      const sku = normalised["sku"];
      if (!sku) {
        console.warn(`Row ${index + 2}: missing SKU, skipping`);
        return null;
      }

      const theoreticalQtyRaw = normalised["theoretical qty"] ?? normalised["theoretical_qty"] ?? "0";
      const theoreticalQty = parseInt(theoreticalQtyRaw, 10) || 0;

      return {
        sku,
        name: normalised["product name"] ?? normalised["name"] ?? "",
        brand: normalised["brand"] ?? normalised["brand/vendor"] ?? normalised["vendor"] ?? "",
        category: normalised["category"] ?? "",
        imageUrl: normalised["image url"] ?? normalised["image_url"] ?? "",
        theoreticalQty,
      } satisfies ProductRow;
    })
    .filter((p): p is ProductRow => p !== null);

  return products;
}

// ─── Report Generation ─────────────────────────────────────────────────────────

/**
 * Build an Excel workbook buffer from report rows.
 * storeNames: ordered list of store names (e.g. ["Colli", "Grimaldi", "Gianicolense"]).
 * Falls back to ["Store1", "Store2", "Store3"] if not provided.
 */
export function generateReport(
  rows: ReportRow[],
  storeNames: [string, string, string] = ["Store1", "Store2", "Store3"]
): Buffer {
  const [s1, s2, s3] = storeNames;

  // Map domain objects to flat row objects
  const data = rows.map((r) => ({
    SKU: r.sku,
    "Product Name": r.productName,
    Brand: r.brand ?? "",
    Category: r.category ?? "",
    "Theoretical Qty": r.theoreticalQty,
    "Global Presence": r.globalPresence,
    [`${s1} Status`]: r.store1Status ?? "NOT_VERIFIED",
    [`${s1} Qty`]: r.store1Status === "NOT_PRESENT" ? 0 : (r.store1Qty ?? ""),
    [`${s2} Status`]: r.store2Status ?? "NOT_VERIFIED",
    [`${s2} Qty`]: r.store2Status === "NOT_PRESENT" ? 0 : (r.store2Qty ?? ""),
    [`${s3} Status`]: r.store3Status ?? "NOT_VERIFIED",
    [`${s3} Qty`]: r.store3Status === "NOT_PRESENT" ? 0 : (r.store3Qty ?? ""),
    "Total Detected Qty": r.totalDetectedQty,
    "Final Status": r.finalStatus,
    "Verification Count": r.verificationCount,
    "Last Verification Date": r.lastVerificationDate
      ? new Date(r.lastVerificationDate).toLocaleString("it-IT")
      : "",
    Notes: r.notes ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-width columns
  const colWidths = Object.keys(data[0] ?? {}).map((key) => ({
    wch: Math.max(key.length, 15),
  }));
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory Report");

  // Return as Node.js Buffer
  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buf;
}

/**
 * Determine the final status for a product given all store verifications.
 *
 * Rules:
 *  - DISPONIBILE:   all stores found it AND detected qty matches theoretical for each
 *  - NON TROVATO:   no store found it (all NOT_PRESENT or NOT_VERIFIED)
 *  - DA RICONTROLLARE: any NOT_SURE result OR mixed present/not_present results
 *  - DISCREPANZA:   found but detected qty differs from theoretical in at least one store
 */
export function computeFinalStatus(
  storeStatuses: Array<{
    status: string | null;  // PRESENT | NOT_PRESENT | NOT_SURE | SKIPPED | null
    detectedQty: number | null;
  }>,
  theoreticalQty: number
): string {
  const verified = storeStatuses.filter((s) => s.status !== null && s.status !== "SKIPPED");

  if (verified.length === 0) return "NON VERIFICATO";

  const hasNotSure = verified.some((s) => s.status === "NOT_SURE");
  if (hasNotSure) return "DA RICONTROLLARE";

  const presentStores = verified.filter((s) => s.status === "PRESENT");
  const notPresentStores = verified.filter((s) => s.status === "NOT_PRESENT");

  // Mixed results
  if (presentStores.length > 0 && notPresentStores.length > 0) return "DA RICONTROLLARE";

  // Nobody found it
  if (presentStores.length === 0) return "NON TROVATO";

  // All stores found it – check quantities
  const qtyMismatch = presentStores.some(
    (s) => s.detectedQty !== null && s.detectedQty !== theoreticalQty
  );

  if (qtyMismatch) return "DISCREPANZA";

  // All stores present AND quantities match (or not entered)
  return "DISPONIBILE";
}
