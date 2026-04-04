"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface ShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Shell({ title, subtitle, children }: ShellProps) {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <Sidebar />
      <div className="ml-[240px]">
        <Header title={title} subtitle={subtitle} />
        <main className="p-8 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
