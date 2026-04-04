"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

export default function TracesPage() {
  const router = useRouter();
  const [traces, setTraces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.listTraces();
        setTraces(Array.isArray(data) ? data : []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Shell title="Traces" subtitle={!loading ? `${traces.length} decisions` : undefined}>
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-6 py-4">
          <p className="text-[13px] text-[#B91C1C]">{error}</p>
        </div>
      ) : traces.length === 0 ? (
        <div className="text-center py-20 animate-fade-up">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
          </div>
          <p className="text-[14px] text-zinc-500 font-medium">No traces yet</p>
          <p className="text-[13px] text-zinc-400 mt-1">Run the simulator to create decisions.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E2E4E9] bg-white overflow-hidden animate-fade-up">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#EFF0F3]">
                <th className="text-left py-3 px-5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Timestamp</th>
                <th className="text-left py-3 px-5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Candidates</th>
                <th className="text-left py-3 px-5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Selected</th>
                <th className="text-left py-3 px-5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Project</th>
                <th className="text-left py-3 px-5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Trace ID</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((trace: any) => {
                const ts = trace.ts_bucket || trace.timestamp;
                const selected = trace.selected_count ?? 0;
                const candidates = trace.candidates_count ?? 0;
                return (
                  <tr
                    key={trace.trace_id || trace.id}
                    className="border-b border-[#EFF0F3] last:border-0 hover:bg-[#F8F9FA] cursor-pointer transition-colors duration-100"
                    onClick={() => router.push(`/traces/${trace.trace_id || trace.id}`)}
                  >
                    <td className="py-3.5 px-5 text-[13px] text-zinc-500 tabular-nums">
                      {ts
                        ? new Date(ts).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="text-[13px] font-mono text-zinc-700 tabular-nums">{candidates}</span>
                    </td>
                    <td className="py-3.5 px-5">
                      {selected > 0 ? (
                        <Badge variant="active" dot>{selected} matched</Badge>
                      ) : (
                        <Badge variant="draft">0 matched</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-[13px] text-zinc-500">
                      {trace.project_name || "—"}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="text-[12px] font-mono text-zinc-400">
                        {(trace.trace_id || trace.id || "").slice(0, 16)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
