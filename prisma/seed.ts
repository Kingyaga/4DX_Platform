import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const databaseUrl = new URL(process.env.DATABASE_URL!);
databaseUrl.searchParams.set("uselibpqcompat", "true");

const adapter = new PrismaPg(databaseUrl.toString());
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding...");

  const org = await db.organization.create({
    data: {
      name: "Acme Corp",
      slug: "acme-corp",
      timezone: "Africa/Lagos",
    },
  });

  const hash = (p: string) => bcrypt.hashSync(p, 12);

  const [admin, lead1, member1, member2, member3] = await Promise.all([
    db.user.create({
      data: {
        name: "Org Admin",
        email: "admin@acme.com",
        passwordHash: hash("password123"),
      },
    }),
    db.user.create({
      data: {
        name: "Chidi Okeke",
        email: "chidi@acme.com",
        passwordHash: hash("password123"),
      },
    }),
    db.user.create({
      data: {
        name: "Emeka Obi",
        email: "emeka@acme.com",
        passwordHash: hash("password123"),
      },
    }),
    db.user.create({
      data: {
        name: "Aisha Bello",
        email: "aisha@acme.com",
        passwordHash: hash("password123"),
      },
    }),
    db.user.create({
      data: {
        name: "Tunde Lawal",
        email: "tunde@acme.com",
        passwordHash: hash("password123"),
      },
    }),
  ]);

  await db.orgMembership.createMany({
    data: [
      { userId: admin.id, orgId: org.id, role: "ADMIN" },
      { userId: lead1.id, orgId: org.id, role: "MEMBER" },
      { userId: member1.id, orgId: org.id, role: "MEMBER" },
      { userId: member2.id, orgId: org.id, role: "MEMBER" },
      { userId: member3.id, orgId: org.id, role: "MEMBER" },
    ],
  });

  const salesTeam = await db.team.create({
    data: {
      name: "Sales Team",
      slug: "sales-team",
      orgId: org.id,
      leadUserId: lead1.id,
    },
  });

  await db.teamMembership.createMany({
    data: [
      { userId: lead1.id, teamId: salesTeam.id, role: "LEAD" },
      { userId: member1.id, teamId: salesTeam.id, role: "MEMBER" },
      { userId: member2.id, teamId: salesTeam.id, role: "MEMBER" },
      { userId: member3.id, teamId: salesTeam.id, role: "MEMBER" },
    ],
  });

  console.log("✅ Seed complete.");
  console.log("─────────────────────────────────");
  console.log("Accounts created (all password: password123):");
  console.log("Admin:   admin@acme.com");
  console.log("Lead:    chidi@acme.com");
  console.log("Member:  emeka@acme.com");
  console.log("Member:  aisha@acme.com");
  console.log("Member:  tunde@acme.com");
  console.log("─────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
