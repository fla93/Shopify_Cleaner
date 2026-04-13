/**
 * POST /api/verifications/start
 * Mark a product as IN_PROGRESS (being verified by current clerk).
 * 
 * Body: { productId }
 * 
 * This prevents other clerks in the same store from seeing this product.
 * Auto-releases after 5 minutes if not completed.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/auth";
import prisma from "../../../../lib/db";
import type { SessionUser } from "../../../../types";

export async function POST(req: NextRequest) {
  // Auth check
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.storeId) {
    return NextResponse.json(
      { error: "Your account is not assigned to a store" },
      { status: 403 }
    );
  }

  let body: { productId: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { productId } = body;

  if (!productId || typeof productId !== "number") {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  try {
    // Check if product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const storeId = parseInt(user.storeId, 10);
    const userId = parseInt(user.id, 10);

    // Atomically delete previous IN_PROGRESS records and create the new one.
    // Using a transaction prevents the window where no IN_PROGRESS exists
    // (which would cause the progress endpoint to return a stale watermark
    // on rapid page refreshes, creating a systematic regression).
    const [, verification] = await prisma.$transaction([
      prisma.verification.deleteMany({
        where: { storeId, userId, status: "IN_PROGRESS" },
      }),
      prisma.verification.create({
        data: {
          productId,
          storeId,
          userId,
          status: "IN_PROGRESS",
        },
      }),
    ]);

    return NextResponse.json(verification, { status: 201 });
  } catch (error) {
    console.error("[POST /api/verifications/start]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
