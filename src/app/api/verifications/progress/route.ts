/**
 * GET /api/verifications/progress
 * Returns the next product to verify for this store's clerk.
 *
 * Logic:
 *  1. Find all productIds with a completed verification (PRESENT/NOT_PRESENT/NOT_SURE) for this store.
 *  2. Find productIds currently locked IN_PROGRESS by OTHER clerks in this store (last 5 min).
 *  3. Return the first product (by id ASC) that is neither completed nor locked.
 *
 * Response: { productId, done, verifiedCount, total }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import prisma from "../../../../lib/db";
import type { SessionUser } from "../../../../types";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;

  if (!user || !user.storeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeId = parseInt(user.storeId, 10);
  const userId = parseInt(user.id, 10);

  const total = await prisma.product.count();

  // 1. Products with a completed verification for this store
  const completedRecords = await prisma.verification.findMany({
    where: {
      storeId,
      status: { in: ["PRESENT", "NOT_PRESENT", "NOT_SURE"] },
    },
    distinct: ["productId"],
    select: { productId: true },
  });
  const completedIds = completedRecords.map((r) => r.productId);
  const verifiedCount = completedIds.length;

  if (verifiedCount >= total) {
    return NextResponse.json({ productId: null, done: true, verifiedCount, total });
  }

  // 2. Products locked IN_PROGRESS by OTHER clerks in this store (last 5 min)
  const lockTimeout = new Date(Date.now() - 5 * 60 * 1000);
  const lockedRecords = await prisma.verification.findMany({
    where: {
      storeId,
      status: "IN_PROGRESS",
      updatedAt: { gt: lockTimeout },
      userId: { not: userId },
    },
    select: { productId: true },
  });
  const lockedIds = lockedRecords.map((r) => r.productId);

  // 3. First unverified, unlocked product (ordered by id ASC)
  const excludeIds = [...new Set([...completedIds, ...lockedIds])];
  const nextProduct = await prisma.product.findFirst({
    where: { id: { notIn: excludeIds } },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  return NextResponse.json({
    productId: nextProduct?.id ?? null,
    done: !nextProduct,
    verifiedCount,
    total,
  });
}
