"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNavigation({ links, studentAction }: { links: { label: string; href: string; exact: boolean }[]; studentAction?: () => Promise<void> }) {
  const path = usePathname();
  const itemClass = "inline-flex min-h-10 shrink-0 items-center rounded-lg px-4 py-2 text-sm font-semibold no-underline transition";
  return <nav aria-label="School navigation" className="flex gap-1 overflow-x-auto border-t border-slate-100 pt-3 pb-1 sm:gap-2">
    {links.map(link => {
      const active = link.exact ? path === link.href || (link.label === "Overview" && path === "/admin/dashboard") : path === link.href || path.startsWith(`${link.href}/`);
      return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`${itemClass} ${active ? "bg-indigo-700 text-white shadow-sm hover:bg-indigo-800 hover:text-white" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"}`}>{link.label}</Link>;
    })}
    {studentAction && <form action={studentAction} className="shrink-0 sm:ml-auto"><button aria-current={path.startsWith("/admin/students") ? "page" : undefined} className={`${itemClass} ${path.startsWith("/admin/students") ? "bg-indigo-700 text-white" : "border border-indigo-200 bg-indigo-50 text-indigo-700"}`}><span aria-hidden="true">+</span> Add student</button></form>}
  </nav>;
}
