"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeBlock, TriggerExpression } from "@/components/ui/code-block";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

export default function TraceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const traceId = params.traceId as string;
  const [trace, setTrace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getTrace(traceId);
        setTrace(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [traceId]);

  if (loading) {
    return (
      <Shell title="Trace">
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell title="Trace">
        <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-6 py-4">
          <p className="text-[13px] text-[#B91C1C]">{error}</p>
        </div>
      </Shell>
    );
  }

  const candidates = trace?.candidates || trace?.evaluations || [];
  const selectedIds = new Set(trace?.selected || []);
  const decisionPoint = trace?.inputs?.decision_point || trace?.decision_point || "—";
  const timestamp = trace?.ts_bucket || trace?.timestamp;

  // Determine overall verdict from winning candidate
  const winningCandidate = candidates.find((c: any) =>
    selectedIds.has(c.emu_id) && c.passed
  );

  return (
    <Shell title="Trace Detail" subtitle={traceId.slice(0, 16)}>
      <div className="space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => router.push("/traces")}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Traces
        </Button>

        {/* Summary */}
        <Card className="animate-fade-up">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1.5">Trace ID</p>
              <p className="text-[12px] font-mono text-zinc-800 break-all">{traceId}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1.5">Decision Point</p>
              <p className="text-[13px] font-mono text-zinc-800 font-medium">{decisionPoint}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1.5">Selected</p>
              <Badge variant={selectedIds.size > 0 ? "active" : "draft"} dot>
                {selectedIds.size} of {candidates.length}
              </Badge>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1.5">Timestamp</p>
              <p className="text-[13px] text-zinc-800 tabular-nums">
                {timestamp ? new Date(timestamp).toLocaleString() : "—"}
              </p>
            </div>
          </div>
        </Card>

        {/* Input Context */}
        {trace?.inputs?.atoms && trace.inputs.atoms.length > 0 && (
          <Card
            header="Input Context"
            className="animate-fade-up stagger-1"
            style={{ opacity: 0 }}
          >
            <div className="rounded-xl bg-[#1E2028] p-4 space-y-1.5">
              {trace.inputs.atoms.map((atom: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-[12px] font-mono">
                  <Badge variant={atom.type === "state" ? "active" : atom.type === "tag" ? "allow" : "draft"}>
                    {atom.type}
                  </Badge>
                  <span className="text-[#73DACA]">{atom.key || atom.kind}</span>
                  <span className="text-[#7982A9]">=</span>
                  <span className="text-[#FF9E64]">{JSON.stringify(atom.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Candidate Waterfall */}
        <Card
          header={`Candidate Waterfall — ${candidates.length} evaluated`}
          className="animate-fade-up stagger-2"
          style={{ opacity: 0 }}
        >
          {candidates.length === 0 ? (
            <p className="text-[13px] text-zinc-400">No candidate evaluations found</p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c: any, i: number) => {
                const isSelected = selectedIds.has(c.emu_id);
                const isSuppressed = !c.passed;
                return (
                  <div
                    key={i}
                    className={`
                      rounded-xl border px-5 py-4 transition-colors
                      ${isSelected
                        ? "border-[#1652F0]/30 bg-[#F0F3FF]"
                        : "border-[#EFF0F3] bg-white"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-mono font-semibold text-zinc-400 tabular-nums w-6">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[13px] font-mono font-semibold text-zinc-900">
                          {c.emu_key || `Candidate ${i + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.score != null && (
                          <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                            score {c.score}
                          </span>
                        )}
                        {isSelected && <Badge variant="active" dot>Selected</Badge>}
                        {isSuppressed && (
                          <Badge variant="draft">
                            {c.suppressed_by?.[0]?.code || "suppressed"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="ml-9 mt-2 space-y-1">
                      <div className="text-[12px]">
                        {c.trigger ? <TriggerExpression>{c.trigger}</TriggerExpression> : <span className="text-zinc-500">—</span>}
                      </div>
                      <p className="text-[11px]">
                        <span className="text-zinc-400">match: </span>
                        <span className={c.passed ? "text-[#16A34A] font-medium" : "text-[#DC2626] font-medium"}>
                          {String(c.passed)}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Raw */}
        <div className="animate-fade-up stagger-3" style={{ opacity: 0 }}>
          <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-2">Raw Trace</p>
          <CodeBlock language="json">{JSON.stringify(trace, null, 2)}</CodeBlock>
        </div>
      </div>
    </Shell>
  );
}
