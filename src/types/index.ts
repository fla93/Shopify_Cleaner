/**
 * Shared TypeScript types for Shopify_Cleaner
 */

// ─── Enums (mirrored from Prisma schema) ──────────────────────────────────────

export type Role = "ADMIN" | "CLERK";

export type VerificationStatus = "PRESENT" | "NOT_PRESENT" | "NOT_SURE" | "SKIPPED";

export type FinalStatus =
  | "DISPONIBILE"
  | "NON TROVATO"
  | "DISCREPANZA"
  | "DA RICONTROLLARE"
  | "NON VERIFICATO";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Store {
  id: number;
  name: string;
  createdAt: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  storeId: number | null;
  storeName?: string | null;
  createdAt: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  theoreticalQty: number;
  createdAt: string;
}

export interface Verification {
  id: number;
  productId: number;
  storeId: number;
  userId: number;
  status: VerificationStatus;
  detectedQty: number | null;
  note: string | null;
  createdAt: string;
  product?: Product;
  store?: Store;
  user?: Pick<User, "id" | "name" | "email">;
}

// ─── Excel Import ──────────────────────────────────────────────────────────────

/** A single row from the import Excel file */
export interface ProductRow {
  sku: string;
  name: string;
  brand: string;
  category: string;
  imageUrl: string;
  theoreticalQty: number;
}

// ─── Excel Report ─────────────────────────────────────────────────────────────

/** A single row in the generated Excel report */
export interface ReportRow {
  sku: string;
  productName: string;
  brand: string | null;
  category: string | null;
  theoreticalQty: number;
  globalPresence: string; // e.g. "2/3 stores"
  store1Status: string | null;
  store1Qty: number | null;
  store2Status: string | null;
  store2Qty: number | null;
  store3Status: string | null;
  store3Qty: number | null;
  totalDetectedQty: number;
  finalStatus: FinalStatus | string;
  verificationCount: number;
  lastVerificationDate: string | null;
  notes: string;
}

// ─── API Payloads ─────────────────────────────────────────────────────────────

/** POST /api/verifications request body */
export interface CreateVerificationPayload {
  productId: number;
  status: VerificationStatus;
  detectedQty?: number | null;
  note?: string | null;
}

/** GET /api/products response */
export interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /api/stats response */
export interface StatsResponse {
  totalProducts: number;
  verifiedProducts: number;       // products with at least one verification
  totalVerifications: number;
  byStatus: Record<string, number>; // final status counts
  byStore: Array<{
    storeId: number;
    storeName: string;
    verificationCount: number;
  }>;
  completionPercent: number;
  notFoundCount: number;          // count of NOT_PRESENT verifications
  presentCount: number;           // count of PRESENT verifications
}

// ─── NextAuth session extension ───────────────────────────────────────────────

/** Augmented session user (extends NextAuth's default) */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  storeId: string | null;
  storeName: string | null;
}
