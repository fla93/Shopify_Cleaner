/**
 * POST /api/import
 * Accepts a multipart form upload with field "file" (.xlsx or .xls).
 * Parses the Excel, then upserts products into the database.
 *
 * Protected: ADMIN only.
 *
 * Response: { imported, updated, skipped, errors }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import prisma from "../../../lib/db";
import { parseImportFile } from "../../../lib/excel";
import type { SessionUser } from "../../../types";

export async function POST(req: NextRequest) {
  // Auth check — admin only
  const session = await getServerSession(authOptions);
  const user = (session?.user as SessionUser | undefined) ?? null;

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Convert the uploaded file to a Buffer
    const arrayBuffer = await (file as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the Excel file
    let rows;
    try {
      rows = parseImportFile(buffer);
    } catch (parseError: any) {
      return NextResponse.json(
        { error: `Failed to parse Excel file: ${parseError.message}` },
        { status: 422 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in the Excel file. Check the column headers." },
        { status: 422 }
      );
    }

    // Upsert each product
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.sku) {
        skipped++;
        continue;
      }

      try {
        const existing = await prisma.product.findUnique({
          where: { sku: row.sku },
        });

        await prisma.product.upsert({
          where: { sku: row.sku },
          update: {
            name: row.name || existing?.name || "",
            brand: row.brand || existing?.brand || null,
            category: row.category || existing?.category || null,
            imageUrl: row.imageUrl || existing?.imageUrl || null,
            theoreticalQty: row.theoreticalQty ?? existing?.theoreticalQty ?? 0,
          },
          create: {
            sku: row.sku,
            name: row.name,
            brand: row.brand || null,
            category: row.category || null,
            imageUrl: row.imageUrl || null,
            theoreticalQty: row.theoreticalQty,
          },
        });

        if (existing) {
          updated++;
        } else {
          imported++;
        }
      } catch (dbError: any) {
        errors.push(`SKU ${row.sku}: ${dbError.message}`);
        skipped++;
      }
    }

    return NextResponse.json({ imported, updated, skipped, errors });
  } catch (error: any) {
    console.error("[POST /api/import]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
