"use client";
import { useActionState } from "react";
import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });
  const inputClass = "mt-2 h-11 w-full rounded-md border border-slate-300 px-3 focus:outline-indigo-600";
  return <form action={action} className="space-y-5">
    <div><label htmlFor="email" className="text-sm font-medium">Email</label><input id="email" name="email" type="email" autoComplete="username" maxLength={254} required className={inputClass} /></div>
    <div><label htmlFor="password" className="text-sm font-medium">Password</label><input id="password" name="password" type="password" autoComplete="current-password" maxLength={256} required className={inputClass} /></div>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Signing in…" : "Sign in"}</Button>
  </form>;
}
