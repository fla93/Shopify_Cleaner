/**
 * GET /api/stats/daily
 * Returns today's verifications (last 24 hours) grouped by store.
 * Accessible by CLERK and ADMIN.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/db";
import type { SessionUser } from "@/types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get stores
    const stores = await prisma.store.findMany({ orderBy: { id: "asc" } });

    // Count verifications from today (last 24 hours), excluding IN_PROGRESS
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const dayVerificationCounts = await prisma.verification.groupBy({
      by: ["storeId"],
      where: {
        status: { not: "IN_PROGRESS" },
        createdAt: { gte: todayStart },
      },
      _count: { id: true },
    });

    // Build per-store stats for today
    const byStore = stores.map((store) => {
      const countEntry = dayVerificationCounts.find((s) => s.storeId === store.id);
      return {
        storeId: store.id,
        storeName: store.name,
        dayVerifications: countEntry?._count?.id ?? 0,
      };
    });

    return NextResponse.json({
      byStore,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/stats/daily]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
