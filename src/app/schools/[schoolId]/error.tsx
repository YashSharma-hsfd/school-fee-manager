"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SchoolPageError({ retry }: { error: unknown; retry: () => void }) {
  return <main id="main-content" className="mx-auto max-w-2xl px-6 py-16"><section className="rounded-2xl border border-slate-200 bg-white p-8"><p className="mb-3 text-sm font-semibold text-indigo-700">School workspace</p><h1 className="text-2xl font-semibold">This page couldn’t load</h1><p role="alert" className="mt-3 leading-relaxed text-slate-600">Your connection or the school database may be temporarily unavailable. Try loading the page again.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => retry()}>Try again</Button><Button asChild variant="outline"><Link href="/schools">Choose a school</Link></Button></div><p className="mt-5 text-xs text-slate-500">If you were saving a payment, check the student’s payment history before entering it again.</p></section></main>;
}
