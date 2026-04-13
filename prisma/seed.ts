/**
 * Prisma seed script
 * Run with: npm run db:seed
 *
 * Creates:
 *  - 3 stores (Colli, Grimaldi, Gianicolense)
 *  - 1 admin user (admin@shopifycleaner.com / admin123)
 *  - 3 clerk users, one per store (colli, grimaldi, gianicolense)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // ── Stores ──────────────────────────────────────────────────────────────────
  const stores = await Promise.all([
    prisma.store.upsert({
      where: { name: "Colli" },
      update: {},
      create: { name: "Colli" },
    }),
    prisma.store.upsert({
      where: { name: "Grimaldi" },
      update: {},
      create: { name: "Grimaldi" },
    }),
    prisma.store.upsert({
      where: { name: "Gianicolense" },
      update: {},
      create: { name: "Gianicolense" },
    }),
  ]);

  console.log(`✅ Stores: ${stores.map((s) => s.name).join(", ")}`);

  // ── Admin user ───────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@shopifycleaner.com" },
    update: {},
    create: {
      email: "admin@shopifycleaner.com",
      passwordHash: adminHash,
      name: "Admin",
      role: "ADMIN",
      storeId: null,
    },
  });
  console.log(`✅ Admin user: ${admin.email} (password: admin123)`);

  // ── Clerk users (one per store) ──────────────────────────────────────────────
  const clerkPassword = await bcrypt.hash("clerk123", 12);
  const clerkNames = ["colli", "grimaldi", "gianicolense"];

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const clerkName = clerkNames[i];
    const email = `${clerkName}@shopifycleaner.com`;
    const clerk = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: clerkPassword,
        name: clerkName.charAt(0).toUpperCase() + clerkName.slice(1),
        role: "CLERK",
        storeId: store.id,
      },
    });
    console.log(`✅ ${clerkName}: ${clerk.email} → ${store.name} (password: clerk123)`);
  }

  console.log("\n🎉 Seed complete!");
  console.log("\nCredentials summary:");
  console.log("  Admin:       admin@shopifycleaner.com  /  admin123");
  console.log("  Colli:       colli@shopifycleaner.com  /  clerk123  →  Colli");
  console.log("  Grimaldi:    grimaldi@shopifycleaner.com  /  clerk123  →  Grimaldi");
  console.log("  Gianicolense: gianicolense@shopifycleaner.com  /  clerk123  →  Gianicolense");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
