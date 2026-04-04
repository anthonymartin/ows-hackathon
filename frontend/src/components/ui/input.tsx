"use client";

import { clsx } from "clsx";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-zinc-600 tracking-[-0.01em]">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={clsx(
          "h-10 rounded-lg border border-[#E2E4E9] bg-white px-3.5",
          "text-[14px] text-zinc-900 placeholder:text-zinc-400",
          "transition-colors duration-150",
          "focus:outline-none focus:border-[#1652F0] focus:ring-1 focus:ring-[#1652F0]/20",
          error && "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20",
          className,
        )}
        {...props}
      />
      {error && <p className="text-[12px] text-[#DC2626]">{error}</p>}
    </div>
  ),
);

Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="flex flex-col gap-2">
      {label && (
        <label htmlFor={id} className="text-[13px] font-medium text-zinc-600 tracking-[-0.01em]">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        className={clsx(
          "rounded-lg border border-[#E2E4E9] bg-white px-3.5 py-3",
          "text-[14px] text-zinc-900 placeholder:text-zinc-400",
          "resize-y min-h-[88px] leading-relaxed",
          "transition-colors duration-150",
          "focus:outline-none focus:border-[#1652F0] focus:ring-1 focus:ring-[#1652F0]/20",
          error && "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20",
          className,
        )}
        {...props}
      />
      {error && <p className="text-[12px] text-[#DC2626]">{error}</p>}
    </div>
  ),
);

Textarea.displayName = "Textarea";
