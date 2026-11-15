import { PrismaClient } from "@prisma/client";
const schemaVersion = "20261114000100-school-fees";
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSchemaVersion?: string };
if (globalForPrisma.prisma && globalForPrisma.prismaSchemaVersion !== schemaVersion) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (!prisma.schoolMembership) {
  throw new Error("The database client is outdated. Stop the development server, run npm run db:prepare, then restart npm run dev -- --webpack.");
}
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaVersion = schemaVersion;
}

