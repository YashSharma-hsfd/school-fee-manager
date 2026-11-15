import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession } from "@/lib/auth";
import { SchoolForm } from "@/components/school-forms";
import { changeOwnPassword } from "@/actions/account";

export default async function AccountPage() {
  const user = await readSession();
  if (!user) redirect("/login");
  return <main className="mx-auto max-w-xl space-y-5 px-6 py-10"><h1 className="text-3xl font-semibold">Your password</h1><p>Signed in as {user.name}. Changing your password signs out all your sessions.</p><SchoolForm action={changeOwnPassword} submit="Change password and sign out" fields={[
    { name: "currentPassword", label: "Current password", type: "password" }, { name: "password", label: "New password (at least 12 characters)", type: "password" }, { name: "confirmation", label: "Confirm new password", type: "password" },
  ]} /><Link className="block text-indigo-700" href="/schools">Back to schools</Link></main>;
}
