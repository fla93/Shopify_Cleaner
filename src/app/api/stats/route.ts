/**
 * GET /api/stats
 * Returns dashboard statistics.
 * Protected: ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import prisma from "../../../lib/db";
import { computeFinalStatus } from "../../../lib/excel";
import type { StatsResponse, SessionUser } from "../../../types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [totalProducts, stores] = await Promise.all([
      prisma.product.count(),
      prisma.store.findMany({ orderBy: { id: "asc" } }),
    ]);

    // Count verifications (excluding IN_PROGRESS which are temporary locks)
    const totalVerifications = await prisma.verification.count({
      where: { status: { not: "IN_PROGRESS" } },
    });

    // Count verifications per store (excluding IN_PROGRESS)
    const storeVerificationCounts = await prisma.verification.groupBy({
      by: ["storeId"],
      where: { status: { not: "IN_PROGRESS" } },
      _count: { id: true },
    });

    // Build per-store stats
    const byStore = stores.map((store) => {
      const countEntry = storeVerificationCounts.find((s) => s.storeId === store.id);
      return {
        storeId: store.id,
        storeName: store.name,
        verificationCount: countEntry?._count?.id ?? 0,
      };
    });

    // Count products that have at least one (non-skipped, non-in-progress) verification
    const verifiedProductIds = await prisma.verification.findMany({
      where: {
        status: { notIn: ["SKIPPED", "IN_PROGRESS"] },
      },
      distinct: ["productId"],
      select: { productId: true },
    });
    const verifiedProducts = verifiedProductIds.length;

    // Compute final status distribution
    // Load products with their latest (non-in-progress) verification per store
    const products = await prisma.product.findMany({
      include: {
        verifications: {
          where: { status: { not: "IN_PROGRESS" } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const byStatus: Record<string, number> = {};

    for (const product of products) {
      // Get latest verification per store
      const latestByStore = new Map<number, (typeof product.verifications)[0]>();
      for (const v of product.verifications) {
        if (!latestByStore.has(v.storeId)) {
          latestByStore.set(v.storeId, v);
        }
      }

      const storeData = stores.map((store) => {
        const v = latestByStore.get(store.id);
        return {
          status: v?.status ?? null,
          detectedQty: v?.detectedQty ?? null,
        };
      });

      const finalStatus = computeFinalStatus(storeData, product.theoreticalQty);
      byStatus[finalStatus] = (byStatus[finalStatus] ?? 0) + 1;
    }

    const completionPercent =
      totalProducts > 0 ? Math.round((verifiedProducts / totalProducts) * 100) : 0;

    // Count raw verification statuses (NOT_PRESENT and PRESENT)
    const statusCounts = await prisma.verification.groupBy({
      by: ["status"],
      where: { status: { not: "IN_PROGRESS" } },
      _count: { id: true },
    });

    let notFoundCount = 0;
    let presentCount = 0;

    for (const entry of statusCounts) {
      if (entry.status === "NOT_PRESENT") {
        notFoundCount = entry._count.id;
      } else if (entry.status === "PRESENT") {
        presentCount = entry._count.id;
      }
    }

    const stats: StatsResponse = {
      totalProducts,
      verifiedProducts,
      totalVerifications,
      byStatus,
      byStore,
      completionPercent,
      notFoundCount,
      presentCount,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[GET /api/stats]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
