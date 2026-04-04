"use client";

import { clsx } from "clsx";

type BadgeVariant = "allow" | "deny" | "draft" | "active" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  allow: "bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]",
  deny: "bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]",
  draft: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  active: "bg-[#EEF2FF] text-[#1652F0] border-[#C7D2FE]",
  neutral: "bg-zinc-50 text-zinc-500 border-[#E2E4E9]",
};

const dotStyles: Record<BadgeVariant, string> = {
  allow: "bg-[#16A34A]",
  deny: "bg-[#DC2626]",
  draft: "bg-[#D97706]",
  active: "bg-[#1652F0]",
  neutral: "bg-zinc-400",
};

export function Badge({ variant = "neutral", children, className, dot }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[11px] font-semibold tracking-wide uppercase",
        variantStyles[variant],
        className,
      )}
    >
      {dot && <span className={clsx("w-1.5 h-1.5 rounded-full", dotStyles[variant])} />}
      {children}
    </span>
  );
}
