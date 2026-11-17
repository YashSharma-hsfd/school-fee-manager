import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "School Fee Manager", description: "School fee management workspace" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><a href="#main-content" className="sr-only z-50 rounded-lg bg-indigo-700 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>{children}</body></html>; }

