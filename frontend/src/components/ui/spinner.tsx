"use client";

import { clsx } from "clsx";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-4 w-4 border-[1.5px]",
  md: "h-5 w-5 border-2",
  lg: "h-7 w-7 border-2",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full border-zinc-200 border-t-[#1652F0] animate-spin",
        sizeMap[size],
        className,
      )}
    />
  );
}
