"use client";

import { clsx } from "clsx";
import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  hover?: boolean;
}

export function Card({ className, header, hover, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-[#E2E4E9] bg-white",
        "transition-all duration-150 ease-out",
        hover && "hover:-translate-y-px hover:border-zinc-300 cursor-pointer",
        className,
      )}
      {...props}
    >
      {header && (
        <div className="border-b border-[#EFF0F3] px-6 py-4">
          {typeof header === "string" ? (
            <h3 className="text-[13px] font-semibold text-zinc-900 tracking-[-0.01em]">{header}</h3>
          ) : (
            header
          )}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
