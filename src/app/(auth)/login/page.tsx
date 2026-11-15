import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth";
import { staffHome } from "@/services/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await readSession();
  if (user) redirect(staffHome(user.role));
  return <main className="flex min-h-screen items-center justify-center px-6 py-12">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold text-indigo-600">School Fee Manager</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Staff sign in</h1>
      <p className="mb-8 mt-2 text-sm text-slate-500">Use the staff account provided by your administrator.</p>
      <LoginForm />
    </section>
  </main>;
}
