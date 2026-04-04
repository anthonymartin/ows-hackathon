"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useAgentStore, type Agent, type AgentBudget } from "@/stores/agents";
import { chainName } from "@/lib/chains";

interface AtomEntry {
  id: string;
  type: "state" | "tag" | "event";
  key: string;
  value: string;
  locked?: boolean;
}

const PRESETS = [
  {
    name: "Approved vendor (ETH)",
    atoms: [
      { type: "state" as const, key: "operator.verified", value: "true" },
      { type: "state" as const, key: "request.amount", value: "0.2" },
      { type: "state" as const, key: "request.currency", value: "ETH" },
      { type: "state" as const, key: "budget.remaining", value: "4.5" },
      { type: "tag" as const, key: "vendor_status", value: "approved" },
      { type: "tag" as const, key: "collection_status", value: "approved" },
    ],
  },
  {
    name: "Unverified operator",
    atoms: [
      { type: "state" as const, key: "operator.verified", value: "false" },
      { type: "state" as const, key: "request.amount", value: "0.05" },
      { type: "state" as const, key: "request.currency", value: "ETH" },
      { type: "state" as const, key: "budget.remaining", value: "2.0" },
    ],
  },
  {
    name: "Over budget (USDC)",
    atoms: [
      { type: "state" as const, key: "operator.verified", value: "true" },
      { type: "state" as const, key: "request.amount", value: "1500" },
      { type: "state" as const, key: "request.currency", value: "USDC" },
      { type: "state" as const, key: "budget.remaining", value: "1000" },
      { type: "tag" as const, key: "vendor_status", value: "approved" },
    ],
  },
];

const BUDGET_KEYS = new Set([
  "budget.remaining", "budget.allocated", "budget.spent",
  "budget.remaining_usd", "budget.allocated_usd", "budget.spent_usd",
  "budget.daily_limit", "budget.daily_spent",
  "budget.daily_limit_usd", "budget.daily_spent_usd",
  "budget.utilization_pct",
  "budget.token", "budget.chain_id", "budget.token_address",
  "agent.id", "agent.name", "agent.eth_address",
]);

let nextId = 0;

function newAtom(): AtomEntry {
  return { id: String(++nextId), type: "state", key: "", value: "" };
}

function truncateAddr(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

export default function SimulatorPage() {
  const router = useRouter();
  const [atoms, setAtoms] = useState<AtomEntry[]>([newAtom()]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdictKey, setVerdictKey] = useState(0);

  // Agent integration
  const { agents, fetchAgents } = useAgentStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [agentBudgets, setAgentBudgets] = useState<AgentBudget[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchAgents();
    api.getPrices().then(setLivePrices).catch(() => {});
  }, [fetchAgents]);

  // When agent selection changes, fetch budgets and inject atoms
  useEffect(() => {
    if (!selectedAgentId) {
      // Remove locked budget atoms
      setAtoms((prev) => prev.filter((a) => !a.locked));
      setAgentBudgets([]);
      return;
    }

    (async () => {
      try {
        const budgets = await api.listBudgets(selectedAgentId);
        setAgentBudgets(budgets);
      } catch {
        setAgentBudgets([]);
      }
    })();
  }, [selectedAgentId]);

  // Inject budget atoms when budgets change
  useEffect(() => {
    if (!selectedAgentId || agentBudgets.length === 0) return;

    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    const budget = agentBudgets[0]; // primary budget

    // Convert BigNumber strings to native token amounts
    const toTokens = (raw: string) => parseInt(raw) / 10 ** budget.decimals;
    const remainingTokens = toTokens(budget.remaining);
    const allocatedTokens = toTokens(budget.allocated);
    const spentTokens = toTokens(budget.spent);

    const budgetAtoms: AtomEntry[] = [
      { id: String(++nextId), type: "state", key: "agent.id", value: agent.id, locked: true },
      { id: String(++nextId), type: "state", key: "agent.name", value: agent.name, locked: true },
      { id: String(++nextId), type: "state", key: "agent.eth_address", value: agent.eth_address, locked: true },
      // Native token amounts (primary)
      { id: String(++nextId), type: "state", key: "budget.remaining", value: remainingTokens.toString(), locked: true },
      { id: String(++nextId), type: "state", key: "budget.allocated", value: allocatedTokens.toString(), locked: true },
      { id: String(++nextId), type: "state", key: "budget.spent", value: spentTokens.toString(), locked: true },
      // USD equivalents (derived)
      { id: String(++nextId), type: "state", key: "budget.remaining_usd", value: budget.remaining_usd.toString(), locked: true },
      { id: String(++nextId), type: "state", key: "budget.allocated_usd", value: budget.allocated_usd.toString(), locked: true },
      { id: String(++nextId), type: "state", key: "budget.spent_usd", value: budget.spent_usd.toString(), locked: true },
      { id: String(++nextId), type: "state", key: "budget.utilization_pct", value: budget.utilization_pct.toString(), locked: true },
      { id: String(++nextId), type: "state", key: "budget.token", value: budget.token, locked: true },
      { id: String(++nextId), type: "state", key: "budget.chain_id", value: budget.chain_id, locked: true },
    ];

    if (budget.token_address) {
      budgetAtoms.push(
        { id: String(++nextId), type: "state", key: "budget.token_address", value: budget.token_address, locked: true },
      );
    }

    if (budget.daily_limit) {
      const dailyLimitTokens = toTokens(budget.daily_limit);
      const dailySpentTokens = toTokens(budget.daily_spent);
      const dailyLimitUsd = parseInt(budget.daily_limit) / 10 ** budget.decimals * budget.usd_rate;
      const dailySpentUsd = parseInt(budget.daily_spent) / 10 ** budget.decimals * budget.usd_rate;
      budgetAtoms.push(
        { id: String(++nextId), type: "state", key: "budget.daily_limit", value: dailyLimitTokens.toString(), locked: true },
        { id: String(++nextId), type: "state", key: "budget.daily_spent", value: dailySpentTokens.toString(), locked: true },
        { id: String(++nextId), type: "state", key: "budget.daily_limit_usd", value: dailyLimitUsd.toString(), locked: true },
        { id: String(++nextId), type: "state", key: "budget.daily_spent_usd", value: dailySpentUsd.toString(), locked: true },
      );
    }

    // Add request.currency atom from budget token
    budgetAtoms.push(
      { id: String(++nextId), type: "state", key: "request.currency", value: budget.token, locked: true },
    );

    // Replace: keep non-locked atoms, remove old budget atoms by key, add new budget atoms
    setAtoms((prev) => {
      const manual = prev.filter((a) => !a.locked && !BUDGET_KEYS.has(a.key) && a.key !== "request.currency");
      return [...budgetAtoms, ...manual];
    });
  }, [agentBudgets, selectedAgentId, agents]);

  function addAtom() {
    setAtoms([...atoms, newAtom()]);
  }

  function removeAtom(id: string) {
    setAtoms(atoms.filter((a) => a.id !== id));
  }

  function updateAtom(id: string, field: keyof AtomEntry, value: string) {
    setAtoms(atoms.map((a) => (a.id === id && !a.locked ? { ...a, [field]: value } : a)));
  }

  function loadPreset(preset: (typeof PRESETS)[0]) {
    const loaded = preset.atoms.map((a) => ({ ...a, id: String(++nextId) }));
    // Keep locked atoms (from agent), replace manual ones
    const locked = atoms.filter((a) => a.locked);
    setAtoms([...locked, ...loaded]);
    setResult(null);
  }

  function buildAtomPayload() {
    return atoms
      .filter((a) => a.key)
      .map((a) => {
        const path = a.type === "tag" ? `tag.${a.key}` : a.type === "event" ? `event.${a.key}` : `state.${a.key}`;
        let parsedValue: any = a.value;
        if (a.value === "true") parsedValue = true;
        else if (a.value === "false") parsedValue = false;
        else if (!isNaN(Number(a.value)) && a.value !== "") parsedValue = Number(a.value);
        return { path, value: parsedValue };
      });
  }

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = buildAtomPayload();
      const res = await api.decide(payload, "ows-gate", selectedAgentId || undefined);
      setResult(res);
      setVerdictKey((k) => k + 1);

      // Refresh budgets after decide (spend may have occurred)
      if (selectedAgentId && res.allowed) {
        const updated = await api.listBudgets(selectedAgentId);
        setAgentBudgets(updated);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <Shell title="Simulator" subtitle="Test gate decisions">
      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Left — Context Builder */}
        <div className="space-y-4 animate-fade-up">
          {/* Agent selector */}
          <Card>
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Agent</p>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[13px] text-zinc-900 bg-zinc-50 focus:outline-none focus:border-[#1652F0] transition-colors cursor-pointer"
              >
                <option value="">No agent (manual context)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {truncateAddr(a.eth_address)}
                  </option>
                ))}
              </select>
              {selectedAgent && agentBudgets.length > 0 && (
                <div className="space-y-2 pt-1">
                  {agentBudgets.map((budget) => {
                    const remainingTokens = parseInt(budget.remaining) / 10 ** budget.decimals;
                    return (
                      <div key={budget.token} className="flex items-center gap-3">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[10px] font-mono font-semibold text-[#1652F0] w-12 justify-center flex-shrink-0">
                          {budget.token}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-zinc-400">{budget.chain_id ? chainName(budget.chain_id) : ""}</span>
                            <span className="font-mono text-zinc-600 tabular-nums">
                              {remainingTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })} {budget.token} remaining
                            </span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(budget.utilization_pct, 100)}%`,
                                backgroundColor: budget.utilization_pct > 80 ? "#DC2626" : budget.utilization_pct > 50 ? "#D97706" : "#1652F0",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          {/* Presets */}
          <Card>
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Presets</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => loadPreset(p)}
                    className="px-3 py-1.5 text-[12px] font-medium text-zinc-600 bg-zinc-50 border border-[#E2E4E9] rounded-lg hover:bg-zinc-100 hover:border-zinc-300 transition-all duration-150 active:scale-[0.98] cursor-pointer"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Context */}
          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Context</p>
                <span className="text-[11px] font-mono text-zinc-400 tabular-nums">{atoms.length}</span>
              </div>

              <div className="space-y-2">
                {atoms.map((atom) => (
                  <div key={atom.id} className={`flex items-center gap-1.5 group ${atom.locked ? "opacity-60" : ""}`}>
                    <select
                      value={atom.type}
                      onChange={(e) => updateAtom(atom.id, "type", e.target.value)}
                      disabled={atom.locked}
                      className="h-9 rounded-lg border border-[#E2E4E9] px-2 text-[12px] font-mono text-zinc-600 bg-zinc-50 focus:outline-none focus:border-[#1652F0] transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option value="state">state</option>
                      <option value="tag">tag</option>
                      <option value="event">event</option>
                    </select>
                    <input
                      value={atom.key}
                      onChange={(e) => updateAtom(atom.id, "key", e.target.value)}
                      placeholder="key"
                      disabled={atom.locked}
                      className="flex-1 h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[12px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#1652F0] transition-colors disabled:cursor-not-allowed disabled:bg-zinc-50"
                    />
                    <input
                      value={atom.value}
                      onChange={(e) => updateAtom(atom.id, "value", e.target.value)}
                      placeholder="value"
                      disabled={atom.locked}
                      className="flex-1 h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[12px] font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#1652F0] transition-colors disabled:cursor-not-allowed disabled:bg-zinc-50"
                    />
                    {atom.locked ? (
                      <div className="w-7 h-7 flex items-center justify-center" title="Auto-injected from agent">
                        <svg className="w-3.5 h-3.5 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      </div>
                    ) : (
                      <button
                        onClick={() => removeAtom(atom.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-300 hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all duration-150 opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="secondary" size="sm" onClick={addAtom}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Context
                </Button>
                <Button size="sm" onClick={handleRun} loading={loading}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                  </svg>
                  Run Gate
                </Button>
              </div>
            </div>
          </Card>

          {error && (
            <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3">
              <p className="text-[13px] text-[#B91C1C]">{error}</p>
            </div>
          )}
        </div>

        {/* Right — Verdict */}
        <div className="space-y-4 sticky top-6 self-start">
          {loading ? (
            <div className="rounded-2xl border border-[#E2E4E9] bg-white flex flex-col items-center justify-center py-24">
              <Spinner size="lg" />
              <p className="text-[13px] text-zinc-400 mt-3">Evaluating policies...</p>
            </div>
          ) : result ? (
            <div key={verdictKey}>
              {/* The Verdict */}
              <div
                className={`
                  rounded-2xl border-2 overflow-hidden animate-verdict
                  ${result.allowed
                    ? "border-[#16A34A]/30 bg-gradient-to-b from-[#F0FDF4] to-white"
                    : "border-[#DC2626]/30 bg-gradient-to-b from-[#FEF2F2] to-white"
                  }
                `}
              >
                <div className="px-8 pt-12 pb-10 text-center">
                  {/* Verdict icon */}
                  <div className="animate-verdict-wash">
                    <div
                      className={`
                        w-20 h-20 rounded-3xl mx-auto flex items-center justify-center
                        ${result.allowed
                          ? "bg-[#16A34A]"
                          : "bg-[#DC2626]"
                        }
                      `}
                    >
                      {result.allowed ? (
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Verdict text */}
                  <h2
                    className={`
                      text-[40px] font-bold tracking-[-0.04em] mt-6 leading-none
                      ${result.allowed ? "text-[#15803D]" : "text-[#B91C1C]"}
                    `}
                  >
                    {result.allowed ? "Allowed" : "Denied"}
                  </h2>

                  {result.reason && (
                    <p className="text-[14px] text-zinc-500 mt-3 max-w-xs mx-auto leading-relaxed animate-fade-in" style={{ animationDelay: "300ms", opacity: 0 }}>
                      {result.reason}
                    </p>
                  )}
                </div>

                {/* Details */}
                <div className="border-t border-[#E2E4E9] px-8 py-6 animate-fade-in" style={{ animationDelay: "400ms", opacity: 0 }}>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Reason Code</p>
                      <p className="text-[13px] font-mono text-zinc-800 font-medium">{result.reason_code || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Matched EMU</p>
                      <p className="text-[13px] font-mono text-zinc-800 font-medium">{result.emu_key || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Trace</p>
                      {result.trace_id ? (
                        <button
                          onClick={() => router.push(`/traces/${result.trace_id}`)}
                          className="text-[13px] font-mono text-[#1652F0] font-medium hover:underline cursor-pointer"
                        >
                          {result.trace_id.slice(0, 8)}...
                        </button>
                      ) : (
                        <p className="text-[13px] font-mono text-zinc-400">—</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Budget snapshot (after spend) */}
                {result.budget_snapshot && (
                  <div className="border-t border-[#E2E4E9] px-8 py-5 animate-fade-in" style={{ animationDelay: "500ms", opacity: 0 }}>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Budget After Spend</p>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[10px] font-mono font-semibold text-[#1652F0]">
                        {result.budget_snapshot.token}
                      </span>
                      {result.budget_snapshot.chain_id && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] font-medium text-zinc-500">
                          {chainName(result.budget_snapshot.chain_id)}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const snap = result.budget_snapshot;
                      const d = snap.decimals;
                      const liveRate = livePrices[snap.token];
                      const toTokens = (raw: string) => parseInt(raw) / 10 ** d;
                      const toUsd = (raw: string, fallback: number) => {
                        const tokens = toTokens(raw);
                        return liveRate ? tokens * liveRate : fallback;
                      };
                      return (
                        <div className="grid grid-cols-3 gap-6">
                          <div>
                            <p className="text-[10px] text-zinc-400 mb-0.5">Remaining</p>
                            <p className="text-[13px] font-mono text-[#15803D] font-semibold tabular-nums">
                              {toTokens(snap.remaining).toLocaleString(undefined, { maximumFractionDigits: 4 })} {snap.token}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-400 tabular-nums">
                              (${toUsd(snap.remaining, snap.remaining_usd).toLocaleString(undefined, { maximumFractionDigits: 2 })})
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-400 mb-0.5">Spent</p>
                            <p className="text-[13px] font-mono text-[#D97706] font-semibold tabular-nums">
                              {toTokens(snap.spent).toLocaleString(undefined, { maximumFractionDigits: 4 })} {snap.token}
                            </p>
                            <p className="text-[10px] font-mono text-zinc-400 tabular-nums">
                              (${toUsd(snap.spent, snap.spent_usd).toLocaleString(undefined, { maximumFractionDigits: 2 })})
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-400 mb-0.5">Utilization</p>
                            <p className="text-[13px] font-mono text-zinc-800 font-semibold tabular-nums">
                              {snap.utilization_pct.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 flex flex-col items-center justify-center py-24">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
                </svg>
              </div>
              <p className="text-[14px] text-zinc-400 font-medium">Run a gate decision</p>
              <p className="text-[12px] text-zinc-300 mt-1">Add context and click Run Gate</p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
