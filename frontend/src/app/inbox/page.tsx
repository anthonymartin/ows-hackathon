"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TriggerExpression } from "@/components/ui/code-block";
import { useEmuStore } from "@/stores/emus";

function emuVerdict(emu: any) {
  const toolId = emu.action?.tool?.tool_id || "";
  if (toolId.endsWith(".allow")) return "allow" as const;
  if (toolId.endsWith(".deny")) return "deny" as const;
  return "neutral" as const;
}

function emuLabel(emu: any) {
  if (!emu.enabled) return "Disabled";
  const v = emuVerdict(emu);
  if (v === "allow") return "Allow";
  if (v === "deny") return "Deny";
  return "Unknown";
}

export default function InboxPage() {
  const router = useRouter();
  const { emus, loading, error, fetch } = useEmuStore();
  const [filter, setFilter] = useState<"all" | "allow" | "deny">("all");

  useEffect(() => {
    fetch();
  }, [fetch]);

  const filtered = emus.filter((emu) => {
    if (filter === "all") return true;
    return emuVerdict(emu) === filter;
  });

  const sorted = [...filtered].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return (
    <Shell title="Policies" subtitle={`${emus.length} rules`}>
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl">
            {(["all", "allow", "deny"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-150 cursor-pointer ${
                  filter === f
                    ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button onClick={() => router.push("/composer")} size="md">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Policy
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-6 py-4">
            <p className="text-[13px] text-[#B91C1C]">{error}</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 animate-fade-up">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="text-[14px] text-zinc-500 font-medium">No policies yet</p>
            <p className="text-[13px] text-zinc-400 mt-1">Create your first policy to get started.</p>
            <Button className="mt-5" onClick={() => router.push("/composer")}>
              Create Policy
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((emu, i) => {
              const verdict = emuVerdict(emu);
              return (
                <Card
                  key={emu.emu_key}
                  hover
                  onClick={() => router.push(`/composer/${emu.emu_key}`)}
                  className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}
                  style={{ opacity: 0 }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-[13px] font-semibold text-zinc-900 font-mono leading-snug tracking-tight">
                        {emu.emu_key}
                      </h3>
                      <Badge variant={emu.enabled ? verdict : "draft"} dot>
                        {emuLabel(emu)}
                      </Badge>
                    </div>

                    <p className="text-[13px] text-zinc-500 leading-relaxed line-clamp-2">
                      {emu.intent}
                    </p>

                    <div className="pt-2 border-t border-[#EFF0F3] truncate">
                      <TriggerExpression className="text-[11px]">{emu.trigger}</TriggerExpression>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                        P{emu.priority}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
