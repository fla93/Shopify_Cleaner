/**
 * GET  /api/verifications?productId=X  — verifica esistente per questo prodotto/negozio
 * POST /api/verifications              — crea nuova verifica
 * PATCH /api/verifications             — aggiorna verifica esistente { id, status, detectedQty?, note? }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import prisma from "../../../lib/db";
import type { CreateVerificationPayload, SessionUser } from "../../../types";

const ALLOWED_STATUSES = ["IN_PROGRESS", "PRESENT", "NOT_PRESENT", "NOT_SURE", "SKIPPED"] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;
  if (!user || !user.storeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const productId = parseInt(req.nextUrl.searchParams.get("productId") ?? "", 10);
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  const storeId = parseInt(user.storeId, 10);
  const verification = await prisma.verification.findFirst({
    where: { productId, storeId, status: { not: "IN_PROGRESS" } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(verification ?? null);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;
  if (!user || !user.storeId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, status, detectedQty, note } = body;

  if (!id || typeof id !== "number") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: "status non valido" }, { status: 400 });
  }

  const storeId = parseInt(user.storeId, 10);
  const existing = await prisma.verification.findUnique({ where: { id } });
  if (!existing || existing.storeId !== storeId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.verification.update({
    where: { id },
    data: { status, detectedQty: detectedQty ?? null, note: note?.trim() ?? null },
  });

  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  // Auth check
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!user.storeId) {
    return NextResponse.json(
      { error: "Your account is not assigned to a store. Contact your admin." },
      { status: 403 }
    );
  }

  let body: CreateVerificationPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate
  const { productId, status, detectedQty, note } = body;

  if (!productId || typeof productId !== "number") {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  if (!status || !ALLOWED_STATUSES.includes(status as any)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    // Ensure the product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const storeId = parseInt(user.storeId, 10);
    const userId = parseInt(user.id, 10);

    // Create verification record
    const verification = await prisma.verification.create({
      data: {
        productId,
        storeId,
        userId,
        status,
        detectedQty: detectedQty ?? null,
        note: note?.trim() ?? null,
      },
    });

    return NextResponse.json(verification, { status: 201 });
  } catch (error) {
    console.error("[POST /api/verifications]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
