"use client";

import { useSessionStore } from "@/stores/session";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { isAuthenticated, org, project } = useSessionStore();

  return (
    <header className="flex items-center justify-between px-8 h-16 border-b border-[#EFF0F3] bg-white">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[18px] font-semibold text-zinc-900 tracking-[-0.025em]">{title}</h2>
        {subtitle && (
          <span className="text-[13px] text-zinc-400">{subtitle}</span>
        )}
      </div>
      {isAuthenticated && (
        <div className="flex items-center gap-2 text-[12px]">
          <span className="font-mono text-zinc-400">{org}</span>
          <span className="text-zinc-300">/</span>
          <span className="font-mono text-zinc-600">{project}</span>
          <span className="w-2 h-2 rounded-full bg-[#16A34A] ml-1.5" title="Connected" />
        </div>
      )}
    </header>
  );
}
