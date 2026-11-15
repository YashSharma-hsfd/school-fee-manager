import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { readSession } from "./auth";
import { prisma } from "./prisma";
import { assertSchoolPermission, SchoolAccessError, type SchoolPermission } from "@/services/school-permissions";

export async function schoolAccess(schoolId: string, permission: SchoolPermission = "view") {
  const user = await readSession();
  if (!user) redirect("/login");
  const membership = await prisma.schoolMembership.findUnique({ where: { schoolId_userId: { schoolId, userId: user.id } }, include: { school: true } });
  if (!membership) notFound();
  try { assertSchoolPermission(membership, permission); }
  catch (error) { if (error instanceof SchoolAccessError) notFound(); throw error; }
  return { user, membership, school: membership.school };
}

export async function activeSchool() {
  const schoolId = (await cookies()).get("school-fee-active-school")?.value;
  if (!schoolId) redirect("/schools");
  const access = await schoolAccess(schoolId);
  if (access.membership.role !== "ADMIN") redirect(`/schools/${schoolId}`);
  return access;
}
