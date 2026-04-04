"use client";

import { clsx } from "clsx";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: [
    "bg-[#1652F0] text-white",
    "hover:bg-[#1244CC]",
    "active:scale-[0.98]",
  ].join(" "),
  secondary: [
    "bg-white text-zinc-800 border border-[#E2E4E9]",
    "hover:bg-zinc-50 hover:border-zinc-300",
    "active:scale-[0.98]",
  ].join(" "),
  danger: [
    "bg-[#DC2626] text-white",
    "hover:bg-[#B91C1C]",
    "active:scale-[0.98]",
  ].join(" "),
  ghost: [
    "text-zinc-500",
    "hover:text-zinc-800 hover:bg-zinc-100",
  ].join(" "),
};

const sizeStyles = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-[13px] gap-2",
  lg: "h-11 px-6 text-[14px] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center font-medium rounded-lg cursor-pointer",
        "transition-all duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1652F0]/30 focus-visible:ring-offset-1",
        "disabled:opacity-40 disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 opacity-70" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
