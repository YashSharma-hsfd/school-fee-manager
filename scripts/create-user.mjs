import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/passwords.ts";
import { z } from "zod";

const account = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["ADMIN", "ACCOUNTANT", "MANAGEMENT"]),
  isPlatformAdmin: z.boolean(),
  password: z.string().min(12).max(256),
}).safeParse({
  isPlatformAdmin: process.env.STAFF_PLATFORM_ADMIN === "true",
  email: process.env.STAFF_EMAIL,
  name: process.env.STAFF_NAME,
  role: process.env.STAFF_ROLE,
  password: process.env.STAFF_PASSWORD,
});

if (!account.success) {
  console.error("Set STAFF_EMAIL, STAFF_NAME, STAFF_ROLE (ADMIN, ACCOUNTANT or MANAGEMENT), and STAFF_PASSWORD (12–256 characters).");
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();
  try {
    const { password, ...data } = account.data;
    await prisma.user.create({ data: { ...data, passwordHash: await hashPassword(password) } });
    console.log("Staff account created.");
  } catch {
    console.error("Could not create account. Check database connectivity, migrations, and whether the email already exists.");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
