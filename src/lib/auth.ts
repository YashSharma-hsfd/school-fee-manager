import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { resolveSession, staffHome, type StaffRole } from "../services/auth";

export const sessionCookie = "school-fee-session";

export async function readSession() {
  const token = (await cookies()).get(sessionCookie)?.value;
  return resolveSession(token, tokenHash => prisma.session.findUnique({
    where: { tokenHash },
    select: { expiresAt: true, user: { select: { id: true, name: true, role: true, isPlatformAdmin: true, isActive: true } } },
  }));
}

export async function requireRole(role: StaffRole) {
  const user = await readSession();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(staffHome(user.role));
  return user;
}
