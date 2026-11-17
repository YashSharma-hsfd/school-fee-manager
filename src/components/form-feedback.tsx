"use client";
import { useEffect, useRef, type ReactNode } from "react";

export function FormFeedback({ error, success, children }: { error?: string; success?: string; children?: ReactNode }) {
  const alert = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) alert.current?.focus({ preventScroll: true }); }, [error]);
  if (!error && !success) return null;
  return <div ref={alert} tabIndex={-1} role={error ? "alert" : "status"} className={`rounded-xl border p-4 text-sm leading-relaxed ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
    <p className="mb-1 font-semibold">{error ? "Check and try again" : "Saved successfully"}</p>
    <p className="whitespace-pre-line">{error || success}</p>{!error && children && <div className="mt-4">{children}</div>}
  </div>;
}
