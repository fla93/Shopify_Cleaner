/**
 * GET /api/products
 * Returns a paginated list of products for the clerk survey.
 * 
 * Query params:
 *  - page (default 1)
 *  - pageSize (default 20)
 *  - brand (optional filter by brand)
 *  - category (optional filter by category)
 * 
 * Excludes products currently being verified by other clerks in the same store.
 * Protected: must be authenticated CLERK.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import prisma from "../../../lib/db";
import type { SessionUser } from "../../../types";

export async function GET(req: NextRequest) {
  // Auth check
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storeId = user.storeId ? parseInt(user.storeId, 10) : null;

  try {
    const { searchParams } = new URL(req.url);

    // Single-product lookup by ID (used by survey page)
    const singleId = searchParams.get("id") ? parseInt(searchParams.get("id")!, 10) : null;
    if (singleId) {
      const product = await prisma.product.findUnique({ where: { id: singleId } });
      if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ products: [product], total: 1, page: 1, pageSize: 1 });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const brand = searchParams.get("brand")?.trim() || null;
    const category = searchParams.get("category")?.trim() || null;
    const skip = (page - 1) * pageSize;

    // Find products currently being verified by OTHER clerks in the same store
    // (lock timeout: 5 minutes). We do NOT exclude the current user's own
    // IN_PROGRESS product — otherwise the product they are viewing disappears
    // from the page and causes an empty-page "No products" error.
    const lockTimeout = new Date(Date.now() - 5 * 60 * 1000);
    const currentUserId = user.id ? parseInt(user.id, 10) : null;
    const productsInProgress = await prisma.verification.findMany({
      where: {
        status: "IN_PROGRESS",
        storeId: storeId || undefined,
        updatedAt: { gt: lockTimeout },
        ...(currentUserId ? { userId: { not: currentUserId } } : {}),
      },
      select: { productId: true },
    });

    const inProgressIds = productsInProgress.map((v) => v.productId);

    // Build WHERE clause
    const where: any = {
      id: { notIn: inProgressIds },
    };
    if (brand) {
      where.brand = { equals: brand };
    }
    if (category) {
      where.category = { equals: category };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { sku: "asc" },
      }),
      prisma.product.count({ where }),
    ]);

    // Get unique brands for filter dropdown
    const allBrands = await prisma.product.findMany({
      distinct: ["brand"],
      where: { brand: { not: null } },
      select: { brand: true },
      orderBy: { brand: "asc" },
    });

    // Get unique categories for filter dropdown
    const allCategories = await prisma.product.findMany({
      distinct: ["category"],
      where: { category: { not: null } },
      select: { category: true },
      orderBy: { category: "asc" },
    });

    return NextResponse.json({
      products,
      total,
      page,
      pageSize,
      brands: allBrands.map((b) => b.brand).filter(Boolean),
      categories: allCategories.map((c) => c.category).filter(Boolean),
      currentBrand: brand,
      currentCategory: category,
    });
  } catch (error) {
    console.error("[GET /api/products]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
