import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import prisma from "../../../../lib/db";
import type { SessionUser } from "../../../../types";

/**
 * GET /api/verifications/history
 *
 * Returns all products already verified (PRESENT | NOT_PRESENT | NOT_SURE)
 * by the current clerk in their store, ordered by product.id ASC.
 * Used to restore the back-navigation history after a page reload or re-login.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeId = user.storeId ? parseInt(user.storeId, 10) : null;
  const userId = parseInt(user.id, 10);
  if (!storeId) return NextResponse.json({ products: [] });

  // Collect all productIds this clerk has completed in this store
  const records = await prisma.verification.findMany({
    where: {
      storeId,
      userId,
      status: { in: ["PRESENT", "NOT_PRESENT", "NOT_SURE"] },
    },
    select: { productId: true },
  });

  const uniqueProductIds = [...new Set(records.map((r) => r.productId))].sort(
    (a, b) => a - b
  );

  if (uniqueProductIds.length === 0) return NextResponse.json({ products: [] });

  const products = await prisma.product.findMany({
    where: { id: { in: uniqueProductIds } },
    orderBy: { id: "asc" },
  });

  return NextResponse.json({ products });
}
