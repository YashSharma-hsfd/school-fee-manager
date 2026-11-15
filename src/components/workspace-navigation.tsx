"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNavigation({ links, studentAction }: { links: { label: string; href: string; exact: boolean }[]; studentAction?: () => Promise<void> }) {
  const path = usePathname();
  const itemClass = "inline-flex min-h-10 shrink-0 items-center rounded-lg px-4 py-2 text-sm font-semibold no-underline transition";
  return <nav aria-label="School navigation" className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
    {links.map(link => {
      const active = link.exact ? path === link.href || (link.label === "Overview" && path === "/admin/dashboard") : path === link.href || path.startsWith(`${link.href}/`);
      return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`${itemClass} ${active ? "bg-indigo-700 text-white shadow-sm hover:bg-indigo-800 hover:text-white" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"}`}>{link.label}</Link>;
    })}
    {studentAction && <form action={studentAction}><button aria-current={path.startsWith("/admin/students") ? "page" : undefined} className={`${itemClass} ${path.startsWith("/admin/students") ? "bg-indigo-700 text-white" : "border border-slate-300 bg-white text-indigo-700"}`}>Student records</button></form>}
  </nav>;
}
