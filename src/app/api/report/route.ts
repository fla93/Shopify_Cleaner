/**
 * GET /api/report
 * Generates and streams a full inventory Excel report.
 * Protected: ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import prisma from "../../../lib/db";
import { generateReport, computeFinalStatus } from "../../../lib/excel";
import type { ReportRow, SessionUser } from "../../../types";

export async function GET(req: NextRequest) {
  // Auth check — admin only
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Load all stores (we need IDs for Store1/2/3)
    const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });

    // Load all products with their verifications
    const products = await prisma.product.findMany({
      orderBy: { sku: "asc" },
      include: {
        verifications: {
          orderBy: { createdAt: "desc" },
          include: { store: true },
        },
      },
    });

    const rows: ReportRow[] = products.map((product) => {
      const verifications = product.verifications;

      // Get the latest verification per store
      const latestByStore = new Map<number, (typeof verifications)[0]>();
      for (const v of verifications) {
        if (!latestByStore.has(v.storeId)) {
          latestByStore.set(v.storeId, v); // already sorted desc, first = latest
        }
      }

      // Build per-store data for 3 stores
      const storeData = stores.map((store) => {
        const v = latestByStore.get(store.id);
        return {
          status: v?.status ?? null,
          detectedQty: v?.detectedQty ?? null,
        };
      });

      // Compute final status
      const finalStatus = computeFinalStatus(storeData, product.theoreticalQty);

      // Total detected qty across stores (sum of PRESENT verifications)
      const totalDetectedQty = storeData.reduce(
        (sum, s) => sum + (s.status === "PRESENT" ? (s.detectedQty ?? 0) : 0),
        0
      );

      // Count stores that found the product
      const presentCount = storeData.filter((s) => s.status === "PRESENT").length;
      const verifiedCount = storeData.filter((s) => s.status !== null).length;

      // Collect all notes
      const allNotes = verifications
        .filter((v) => v.note)
        .map((v) => `[${v.store.name}] ${v.note}`)
        .join(" | ");

      // Last verification date
      const lastVerification = verifications[0]; // already sorted desc

      return {
        sku: product.sku,
        productName: product.name,
        brand: product.brand,
        category: product.category,
        theoreticalQty: product.theoreticalQty,
        globalPresence: verifiedCount > 0
          ? `${presentCount}/${stores.length} stores`
          : "Not verified",
        store1Status: storeData[0]?.status ?? null,
        store1Qty: storeData[0]?.detectedQty ?? null,
        store2Status: storeData[1]?.status ?? null,
        store2Qty: storeData[1]?.detectedQty ?? null,
        store3Status: storeData[2]?.status ?? null,
        store3Qty: storeData[2]?.detectedQty ?? null,
        totalDetectedQty,
        finalStatus,
        verificationCount: verifications.length,
        lastVerificationDate: lastVerification?.createdAt?.toISOString() ?? null,
        notes: allNotes,
      } satisfies ReportRow;
    });

    // Generate Excel buffer — use actual store names ordered by id ASC
    const storeNames = stores.map((s) => s.name) as [string, string, string];
    const buffer = generateReport(rows, storeNames);
    const dateStr = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="inventory-report-${dateStr}.xlsx"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("[GET /api/report]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
