import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold no-underline shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50", { variants: { variant: { default: "bg-indigo-700 text-white hover:bg-indigo-800", outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50", danger: "bg-red-700 text-white hover:bg-red-800" }, size: { default: "min-h-11 px-4 py-2.5", sm: "min-h-10 px-3 py-2" } }, defaultVariants: { variant: "default", size: "default" } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) { const Comp = asChild ? Slot : "button"; return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />; }

