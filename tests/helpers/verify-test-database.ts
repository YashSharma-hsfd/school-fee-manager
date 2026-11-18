import { PrismaClient } from "@prisma/client";
import { assertDisposableTestDatabase } from "./cleanup-school";

// Runs before test files can create fixtures or change database triggers.
export default async function verifyTestDatabase() {
  const client = new PrismaClient();
  try {
    const [{ name }] = await client.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    assertDisposableTestDatabase(name);
  } finally {
    await client.$disconnect();
  }
}
