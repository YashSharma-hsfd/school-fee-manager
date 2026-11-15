import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { verifyPassword } from "../lib/passwords";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});
export type StaffRole = "ADMIN" | "ACCOUNTANT" | "MANAGEMENT";
export type SessionUser = { id: string; name: string; role: StaffRole };
export const sessionLifetime = 8 * 60 * 60 * 1000;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const dummyHash = `scrypt:${"0".repeat(32)}:${"0".repeat(128)}`;

type LoginDependencies = {
  consumeAttempt(email: string, now: Date): Promise<boolean>;
  findUser(email: string): Promise<(SessionUser & { active: boolean; passwordHash: string }) | null>;
  saveSession(data: { tokenHash: string; userId: string; expiresAt: Date }): Promise<unknown>;
};

export async function authenticate(input: unknown, dependencies: LoginDependencies, now = new Date()) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;
  if (!await dependencies.consumeAttempt(email, now)) return null;
  const user = await dependencies.findUser(email);
  const valid = await verifyPassword(password, user?.passwordHash ?? dummyHash);
  if (!valid || !user?.active || !["ADMIN", "ACCOUNTANT", "MANAGEMENT"].includes(user.role)) return null;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + sessionLifetime);
  await dependencies.saveSession({ tokenHash: tokenHash(token), userId: user.id, expiresAt });
  return { token, expiresAt, role: user.role };
}

export async function resolveSession(
  token: string | undefined,
  find: (hash: string) => Promise<{ expiresAt: Date; user: SessionUser & { active: boolean } } | null>,
  now = new Date(),
): Promise<SessionUser | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await find(tokenHash(token));
  if (!session || session.expiresAt <= now || !session.user.active) return null;
  const { id, name, role } = session.user;
  if (role !== "ADMIN" && role !== "ACCOUNTANT" && role !== "MANAGEMENT") return null;
  return { id, name, role };
}

export function staffHome(role: StaffRole) {
  return role === "ADMIN" ? "/admin/dashboard" : role === "ACCOUNTANT" ? "/accountant" : "/schools";
}
