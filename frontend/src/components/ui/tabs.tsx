"use client";

import { clsx } from "clsx";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={clsx("flex gap-1 p-1 bg-zinc-100 rounded-xl w-fit", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={clsx(
            "px-4 py-2 text-[13px] font-medium rounded-lg transition-all duration-150 cursor-pointer",
            active === tab.key
              ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
              : "text-zinc-500 hover:text-zinc-700",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
