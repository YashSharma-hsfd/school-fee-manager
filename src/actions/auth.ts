"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sessionCookie } from "@/lib/auth";
import { authenticate, staffHome, tokenHash } from "@/services/auth";

export async function login(_state: { error: string }, formData: FormData) {
  let result;
  try {
    result = await authenticate({ email: formData.get("email"), password: formData.get("password") }, {
      consumeAttempt: async (email, now) => {
        // A single atomic upsert keeps the limit shared across server instances.
        const rows = await prisma.$queryRaw<{ count: number }[]>`
          INSERT INTO "LoginAttempt" ("email", "count", "expiresAt")
          VALUES (${email}, 1, ${new Date(now.getTime() + 15 * 60 * 1000)})
          ON CONFLICT ("email") DO UPDATE SET
            "count" = CASE WHEN "LoginAttempt"."expiresAt" <= ${now} THEN 1 ELSE "LoginAttempt"."count" + 1 END,
            "expiresAt" = CASE WHEN "LoginAttempt"."expiresAt" <= ${now} THEN EXCLUDED."expiresAt" ELSE "LoginAttempt"."expiresAt" END
          RETURNING "count"`;
        return rows[0].count <= 10;
      },
      findUser: email => prisma.user.findUnique({ where: { email } }),
      saveSession: data => prisma.session.create({ data }),
    });
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again later." };
  }
  if (!result) return { error: "Unable to sign in. Check your details or try again in 15 minutes." };
  (await cookies()).set(sessionCookie, result.token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: result.expiresAt,
  });
  redirect(staffHome(result.role));
}

export async function logout() {
  const store = await cookies();
  const token = store.get(sessionCookie)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  store.delete(sessionCookie);
  store.delete("school-fee-active-school");
  redirect("/login");
}
