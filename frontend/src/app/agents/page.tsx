"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAgentStore, type Agent } from "@/stores/agents";
import { api } from "@/lib/api";

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AgentsPage() {
  const router = useRouter();
  const { agents, loading, error, fetchAgents } = useAgentStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [ethAddress, setEthAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [budgetSummaries, setBudgetSummaries] = useState<Record<string, { total_usd: number; utilization: number; tokens: { symbol: string; allocated: string; spent: string; decimals: number; usd_rate: number }[] }>>({});
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAgents();
    api.getPrices().then(setLivePrices).catch(() => {});
  }, [fetchAgents]);

  // Fetch budget summaries for each agent
  useEffect(() => {
    agents.forEach(async (agent) => {
      try {
        const budgets = await api.listBudgets(agent.id);
        const liveUsd = (raw: string, decimals: number, token: string, fallbackRate: number) => {
          const rate = livePrices[token] ?? fallbackRate;
          return parseInt(raw) / 10 ** decimals * rate;
        };
        const total_usd = budgets.reduce((sum: number, b: any) => sum + liveUsd(b.allocated, b.decimals, b.token, b.usd_rate), 0);
        const spent_usd = budgets.reduce((sum: number, b: any) => sum + liveUsd(b.spent, b.decimals, b.token, b.usd_rate), 0);
        const utilization = total_usd > 0 ? (spent_usd / total_usd) * 100 : 0;
        const tokens = budgets.map((b: any) => ({ symbol: b.token as string, allocated: b.allocated as string, spent: b.spent as string, decimals: b.decimals as number, usd_rate: b.usd_rate as number }));
        setBudgetSummaries((prev) => ({ ...prev, [agent.id]: { total_usd, utilization, tokens } }));
      } catch {
        // Budget fetch failed, skip
      }
    });
  }, [agents, livePrices]);

  async function handleCreate() {
    if (!name.trim() || !ethAddress.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const agent = await useAgentStore.getState().createAgent(name.trim(), ethAddress.trim());
      setName("");
      setEthAddress("");
      setShowForm(false);
      router.push(`/agents/${agent.id}`);
    } catch (e: any) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Shell title="Agents" subtitle={`${agents.length} registered`}>
      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div />
          <Button onClick={() => setShowForm(!showForm)} size="md">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Agent
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card className="animate-fade-up border-[#1652F0]/20">
            <div className="space-y-4">
              <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">New Agent</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1.5 block">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Trading Bot Alpha"
                    className="w-full h-9 rounded-lg border border-[#E2E4E9] px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#1652F0] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1.5 block">ETH Address</label>
                  <input
                    value={ethAddress}
                    onChange={(e) => setEthAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full h-9 rounded-lg border border-[#E2E4E9] px-3 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#1652F0] transition-colors"
                  />
                </div>
              </div>
              {createError && (
                <p className="text-[12px] text-[#B91C1C]">{createError}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} loading={creating}>
                  Create Agent
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-6 py-4">
            <p className="text-[13px] text-[#B91C1C]">{error}</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20 animate-fade-up">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <p className="text-[14px] text-zinc-500 font-medium">No agents yet</p>
            <p className="text-[13px] text-zinc-400 mt-1">Register your first agent to manage budgets.</p>
            <Button className="mt-5" onClick={() => setShowForm(true)}>
              Add Agent
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent, i) => {
              const summary = budgetSummaries[agent.id];
              return (
                <Card
                  key={agent.id}
                  hover
                  onClick={() => router.push(`/agents/${agent.id}`)}
                  className={`animate-fade-up stagger-${Math.min(i + 1, 5)}`}
                  style={{ opacity: 0 }}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                          <span className="text-[13px] font-bold text-[#1652F0]">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-[13px] font-semibold text-zinc-900 leading-snug">
                            {agent.name}
                          </h3>
                          <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
                            {truncateAddress(agent.eth_address)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="active" dot>Active</Badge>
                    </div>

                    {/* Budget bar */}
                    {summary && summary.total_usd > 0 ? (
                      <div className="pt-2 border-t border-[#EFF0F3]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-zinc-400 font-medium">Budget</span>
                          <div className="flex items-center gap-2">
                            {summary.tokens.map((t) => (
                              <span key={t.symbol} className="text-[11px] font-mono text-zinc-600 tabular-nums">
                                {(parseInt(t.allocated) / 10 ** t.decimals).toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                                <span className="text-[#1652F0] font-semibold">{t.symbol}</span>
                              </span>
                            ))}
                            <span className="text-[10px] text-zinc-400 tabular-nums">
                              (${summary.total_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(summary.utilization, 100)}%`,
                              backgroundColor: summary.utilization > 80 ? "#DC2626" : summary.utilization > 50 ? "#D97706" : "#1652F0",
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1 tabular-nums">
                          {summary.utilization.toFixed(1)}% utilized
                        </p>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-[#EFF0F3]">
                        <p className="text-[11px] text-zinc-400 italic">No budgets allocated</p>
                      </div>
                    )}
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
