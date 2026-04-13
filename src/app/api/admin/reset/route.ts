/**
 * POST /api/admin/reset
 * Reset all products and verifications (admin only).
 * 
 * This clears:
 * - All Product records
 * - All Verification records
 * 
 * Protected: ADMIN only.
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

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    // Delete all verifications first (foreign key constraint)
    const deletedVerifications = await prisma.verification.deleteMany({});

    // Delete all products
    const deletedProducts = await prisma.product.deleteMany({});

    return NextResponse.json(
      {
        success: true,
        message: "Data reset successfully",
        deletedVerifications: deletedVerifications.count,
        deletedProducts: deletedProducts.count,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /api/admin/reset]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
