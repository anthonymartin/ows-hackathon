"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAgentStore, type Agent, type AgentBudget } from "@/stores/agents";
import { api } from "@/lib/api";
import { CHAINS, chainName, chainOption, ALL_CHAIN_IDS } from "@/lib/chains";

const TOKEN_PRESETS: Record<string, { decimals: number; defaultRate: number; chains: string[]; address?: Record<string, string> }> = {
  ETH: { decimals: 18, defaultRate: 2500, chains: ["eip155:1", "eip155:8453", "eip155:42161", "eip155:10"] },
  USDC: {
    decimals: 6, defaultRate: 1, chains: ["eip155:1", "eip155:137", "eip155:8453", "eip155:42161", "eip155:10"],
    address: {
      "eip155:1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "eip155:137": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "eip155:42161": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "eip155:10": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    },
  },
  USDT: {
    decimals: 6, defaultRate: 1, chains: ["eip155:1", "eip155:137", "eip155:56"],
    address: {
      "eip155:1": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "eip155:137": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    },
  },
  SOL: { decimals: 9, defaultRate: 150, chains: ["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"] },
  MATIC: { decimals: 18, defaultRate: 0.5, chains: ["eip155:137"] },
  BTC: { decimals: 8, defaultRate: 70000, chains: ["bip122:000000000019d6689c085ae165831e93"] },
  ATOM: { decimals: 6, defaultRate: 8, chains: ["cosmos:cosmoshub-4"] },
  SUI: { decimals: 9, defaultRate: 1.5, chains: ["sui:mainnet"] },
};

function formatBigNumber(raw: string, decimals: number): string {
  const n = BigInt(raw);
  const divisor = BigInt(10 ** decimals);
  const whole = n / divisor;
  const fraction = n % divisor;
  if (fraction === BigInt(0)) return whole.toString();
  const fracStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fracStr.slice(0, 4)}`;
}

function humanToRaw(amount: string, decimals: number): string {
  const parts = amount.split(".");
  const whole = parts[0] || "0";
  let frac = parts[1] || "";
  frac = frac.padEnd(decimals, "0").slice(0, decimals);
  return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(frac)).toString();
}

function chainBadge(chainId: string) {
  const chain = CHAINS[chainId];
  if (!chain) return <span className="text-[10px] font-mono text-zinc-400">{chainId}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-zinc-100 text-[10px] font-medium text-zinc-600">
      {chain.name}
      <span className="text-zinc-400">{chain.family}</span>
    </span>
  );
}

function truncateAddress(addr: string) {
  if (!addr || addr.length <= 12) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.agentId as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [budgets, setBudgets] = useState<AgentBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live prices
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);

  // Allocate form
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState("ETH");
  const [customToken, setCustomToken] = useState("");
  const [isCustomToken, setIsCustomToken] = useState(false);
  const [chainId, setChainId] = useState("eip155:1");
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [usdRate, setUsdRate] = useState("");
  const [decimals, setDecimals] = useState(18);
  const [dailyLimit, setDailyLimit] = useState("");
  const [allocating, setAllocating] = useState(false);
  const [allocError, setAllocError] = useState<string | null>(null);

  // Edit agent
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete agent
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete budget
  const [deletingBudget, setDeletingBudget] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [a, b, prices] = await Promise.all([
        api.getAgent(agentId),
        api.listBudgets(agentId),
        api.getPrices().catch(() => ({} as Record<string, number>)),
      ]);
      setAgent(a);
      setLivePrices(prices);
      setBudgets(b);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [agentId]);

  // Fetch live prices when allocate form opens (refresh)
  useEffect(() => {
    if (!showForm) return;
    setPricesLoading(true);
    api.getPrices()
      .then((prices) => {
        setLivePrices(prices);
        // Auto-set rate for current token
        const currentToken = isCustomToken ? customToken.toUpperCase() : token;
        if (prices[currentToken] && !usdRate) {
          setUsdRate(prices[currentToken].toString());
        } else if (prices[token] && !usdRate) {
          setUsdRate(prices[token].toString());
        }
      })
      .catch(() => {})
      .finally(() => setPricesLoading(false));
  }, [showForm]);

  function handleTokenChange(t: string) {
    if (t === "__custom__") {
      setIsCustomToken(true);
      setCustomToken("");
      setTokenAddress("");
      setDecimals(18);
      setUsdRate("");
      return;
    }
    setIsCustomToken(false);
    setToken(t);
    const preset = TOKEN_PRESETS[t];
    if (preset) {
      // Prefer live price, fall back to preset default
      const liveRate = livePrices[t];
      setUsdRate(liveRate ? liveRate.toString() : preset.defaultRate.toString());
      setDecimals(preset.decimals);
      // Auto-set chain to first available
      if (preset.chains.length > 0 && !preset.chains.includes(chainId)) {
        setChainId(preset.chains[0]);
      }
      // Auto-set token address for chain
      if (preset.address && preset.address[chainId]) {
        setTokenAddress(preset.address[chainId]);
      } else if (preset.address) {
        const firstChain = preset.chains[0];
        setTokenAddress(preset.address[firstChain] || "");
      } else {
        setTokenAddress("");
      }
    }
  }

  function handleChainChange(cId: string) {
    setChainId(cId);
    // Update token address if preset has one for this chain
    if (!isCustomToken) {
      const preset = TOKEN_PRESETS[token];
      if (preset?.address?.[cId]) {
        setTokenAddress(preset.address[cId]);
      } else {
        setTokenAddress("");
      }
    }
  }

  async function handleAllocate() {
    const effectiveToken = isCustomToken ? customToken.trim().toUpperCase() : token;
    if (!effectiveToken || !amount.trim() || !usdRate.trim()) return;
    setAllocating(true);
    setAllocError(null);
    try {
      const raw = humanToRaw(amount.trim(), decimals);
      const dailyRaw = dailyLimit.trim() ? humanToRaw(dailyLimit.trim(), decimals) : null;

      await api.allocateBudget(agentId, {
        token: effectiveToken,
        chain_id: chainId,
        token_address: tokenAddress || null,
        decimals,
        allocated: raw,
        usd_rate: parseFloat(usdRate),
        daily_limit: dailyRaw,
      });

      setAmount("");
      setDailyLimit("");
      setShowForm(false);
      setIsCustomToken(false);
      await load();
    } catch (e: any) {
      setAllocError(e.message);
    } finally {
      setAllocating(false);
    }
  }

  function startEditing() {
    if (!agent) return;
    setEditName(agent.name);
    setEditAddress(agent.eth_address);
    setEditError(null);
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    setEditError(null);
    try {
      await api.updateAgent(agentId, { name: editName.trim() || undefined, eth_address: editAddress.trim() || undefined });
      setEditing(false);
      await load();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAgent() {
    setDeleting(true);
    try {
      await api.deleteAgent(agentId);
      router.push("/agents");
    } catch (e: any) {
      setError(e.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleDeleteBudget(tokenName: string) {
    setDeletingBudget(tokenName);
    try {
      await api.deleteBudget(agentId, tokenName);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingBudget(null);
    }
  }

  if (loading) {
    return (
      <Shell title="Agent" subtitle="Loading...">
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Shell>
    );
  }

  if (error || !agent) {
    return (
      <Shell title="Agent" subtitle="Error">
        <div className="rounded-2xl bg-[#FEF2F2] border border-[#FECACA] px-6 py-4">
          <p className="text-[13px] text-[#B91C1C]">{error || "Agent not found"}</p>
        </div>
      </Shell>
    );
  }

  // Recompute USD values with live prices where available
  function liveUsd(raw: string, decimals: number, token: string, fallbackRate: number): number {
    const rate = livePrices[token] ?? fallbackRate;
    return parseInt(raw) / 10 ** decimals * rate;
  }

  const budgetsLive = budgets.map((b) => {
    const rate = livePrices[b.token] ?? b.usd_rate;
    const allocated_usd = liveUsd(b.allocated, b.decimals, b.token, b.usd_rate);
    const spent_usd = liveUsd(b.spent, b.decimals, b.token, b.usd_rate);
    const remaining_usd = liveUsd(b.remaining, b.decimals, b.token, b.usd_rate);
    const utilization_pct = allocated_usd > 0 ? (spent_usd / allocated_usd) * 100 : 0;
    return { ...b, allocated_usd, spent_usd, remaining_usd, utilization_pct, live_rate: rate };
  });

  const totalAllocatedUsd = budgetsLive.reduce((s, b) => s + b.allocated_usd, 0);
  const totalSpentUsd = budgetsLive.reduce((s, b) => s + b.spent_usd, 0);
  const totalRemainingUsd = budgetsLive.reduce((s, b) => s + b.remaining_usd, 0);
  const tokenList = budgets.map((b) => b.token);
  const hasLivePrices = Object.keys(livePrices).length > 0;

  // Determine available chains for the current token
  const availableChains = isCustomToken
    ? ALL_CHAIN_IDS
    : (TOKEN_PRESETS[token]?.chains.length ? TOKEN_PRESETS[token].chains : ALL_CHAIN_IDS);

  return (
    <Shell title={agent.name} subtitle="Agent">
      <div className="space-y-6">
        {/* Back link */}
        <button
          onClick={() => router.push("/agents")}
          className="inline-flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          All Agents
        </button>

        {/* Agent header card */}
        <Card className="animate-fade-up">
          {editing ? (
            <div className="space-y-4">
              <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Edit Agent</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1 block">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E2E4E9] px-3 text-[13px] text-zinc-900 focus:outline-none focus:border-[#1652F0] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1 block">ETH Address</label>
                  <input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E2E4E9] px-3 text-[13px] font-mono text-zinc-900 focus:outline-none focus:border-[#1652F0] transition-colors"
                  />
                </div>
              </div>
              {editError && <p className="text-[12px] text-[#B91C1C]">{editError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} loading={saving}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                  <span className="text-[20px] font-bold text-[#1652F0]">
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-zinc-900 tracking-[-0.02em]">{agent.name}</h2>
                  <p className="text-[13px] font-mono text-zinc-400 mt-0.5 select-all">{agent.eth_address}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-[11px] text-zinc-400">
                      Created {new Date(agent.created_at + "Z").toLocaleDateString()}
                    </p>
                    {tokenList.length > 0 && (
                      <div className="flex gap-1">
                        {tokenList.map((t) => (
                          <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#EEF2FF] text-[10px] font-mono font-semibold text-[#1652F0]">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={startEditing}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                  title="Edit agent"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleDeleteAgent} loading={deleting} className="!bg-[#DC2626] !text-white hover:!bg-[#B91C1C]">
                      Confirm
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer"
                    title="Delete agent"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 animate-fade-up stagger-1" style={{ opacity: 0 }}>
          {([
            { label: "Allocated", field: "allocated" as const, usd: totalAllocatedUsd, color: "text-zinc-900" },
            { label: "Spent", field: "spent" as const, usd: totalSpentUsd, color: "text-[#D97706]" },
            { label: "Remaining", field: "remaining" as const, usd: totalRemainingUsd, color: "text-[#15803D]" },
          ] as const).map((stat) => (
            <Card key={stat.label}>
              <div>
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {stat.label}
                  {hasLivePrices && <span className="text-[8px] text-emerald-600">LIVE</span>}
                </p>
                <div className="space-y-0.5">
                  {budgetsLive.map((b) => (
                    <p key={b.token} className={`text-[18px] font-semibold ${stat.color} tabular-nums tracking-tight font-mono`}>
                      {formatBigNumber(b[stat.field], b.decimals)} <span className="text-[13px] text-[#1652F0]">{b.token}</span>
                    </p>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1 tabular-nums">
                  (${stat.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Budget table */}
        <Card
          header={
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-zinc-900">Token Budgets</h3>
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Allocate
              </Button>
            </div>
          }
          className="animate-fade-up stagger-2"
          style={{ opacity: 0 }}
        >
          {/* Allocate form */}
          {showForm && (
            <div className="mb-6 p-4 rounded-xl bg-zinc-50 border border-[#EFF0F3] space-y-3">
              <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Allocate Token Budget</p>

              {/* Row 1: Token + Chain */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1 block">Token</label>
                  <select
                    value={isCustomToken ? "__custom__" : token}
                    onChange={(e) => handleTokenChange(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[13px] font-mono text-zinc-900 bg-white focus:outline-none focus:border-[#1652F0] transition-colors cursor-pointer"
                  >
                    {Object.keys(TOKEN_PRESETS).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                    <option value="__custom__">Custom ERC-20...</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1 block">Chain</label>
                  <select
                    value={chainId}
                    onChange={(e) => handleChainChange(e.target.value)}
                    className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[13px] text-zinc-900 bg-white focus:outline-none focus:border-[#1652F0] transition-colors cursor-pointer"
                  >
                    {availableChains.map((cId) => (
                      <option key={cId} value={cId}>
                        {chainOption(cId)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1 block">Amount</label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="5.0"
                    className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 bg-white focus:outline-none focus:border-[#1652F0] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1 block flex items-center gap-1.5">
                    USD Rate
                    {livePrices[isCustomToken ? customToken.toUpperCase() : token] && (
                      <span className="text-[9px] text-emerald-600 font-normal">LIVE</span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      value={usdRate}
                      onChange={(e) => setUsdRate(e.target.value)}
                      placeholder={pricesLoading ? "Loading..." : "2500"}
                      className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 pr-8 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 bg-white focus:outline-none focus:border-[#1652F0] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setPricesLoading(true);
                        try {
                          const prices = await api.getPrices();
                          setLivePrices(prices);
                          const sym = isCustomToken ? customToken.toUpperCase() : token;
                          if (prices[sym]) setUsdRate(prices[sym].toString());
                        } catch {}
                        setPricesLoading(false);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-zinc-400 hover:text-[#1652F0] transition-colors cursor-pointer"
                      title="Fetch live rate"
                    >
                      <svg className={`w-3.5 h-3.5 ${pricesLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Custom token fields + Daily limit */}
              {isCustomToken && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-500 font-medium mb-1 block">Token Symbol</label>
                    <input
                      value={customToken}
                      onChange={(e) => setCustomToken(e.target.value)}
                      placeholder="WBTC"
                      className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 bg-white focus:outline-none focus:border-[#1652F0] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 font-medium mb-1 block">Contract Address</label>
                    <input
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 bg-white focus:outline-none focus:border-[#1652F0] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 font-medium mb-1 block">Decimals</label>
                    <input
                      value={decimals}
                      onChange={(e) => setDecimals(parseInt(e.target.value) || 18)}
                      type="number"
                      className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[13px] font-mono text-zinc-900 bg-white focus:outline-none focus:border-[#1652F0] transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium mb-1 block">Daily Limit</label>
                  <input
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    placeholder="Optional"
                    className="w-full h-9 rounded-lg border border-[#E2E4E9] px-2.5 text-[13px] font-mono text-zinc-900 placeholder:text-zinc-400 bg-white focus:outline-none focus:border-[#1652F0] transition-colors"
                  />
                </div>
              </div>

              {amount && usdRate && (
                <p className="text-[11px] text-zinc-500">
                  = <span className="font-mono font-medium text-zinc-700">
                    ${(parseFloat(amount || "0") * parseFloat(usdRate || "0")).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span> USD
                  {tokenAddress && (
                    <span className="ml-2 text-zinc-400">
                      Contract: {truncateAddress(tokenAddress)}
                    </span>
                  )}
                </p>
              )}
              {allocError && <p className="text-[12px] text-[#B91C1C]">{allocError}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAllocate} loading={allocating}>Allocate</Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setIsCustomToken(false); }}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Budget table */}
          {budgetsLive.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[13px] text-zinc-400">No token budgets allocated yet.</p>
              {!showForm && (
                <Button className="mt-3" size="sm" onClick={() => setShowForm(true)}>
                  Allocate First Budget
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#EFF0F3]">
                    {["Token", "Chain", "Rate", "Allocated", "Spent", "Remaining", "Utilization", ""].map((h) => (
                      <th key={h} className="px-6 py-2.5 text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {budgetsLive.map((b) => (
                    <tr key={b.token} className="border-b border-[#EFF0F3] last:border-0 hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-[#EEF2FF] flex items-center justify-center text-[10px] font-bold text-[#1652F0]">
                            {b.token.charAt(0)}
                          </span>
                          <div>
                            <span className="text-[13px] font-semibold text-zinc-900 font-mono">{b.token}</span>
                            {b.token_address && (
                              <p className="text-[10px] font-mono text-zinc-400">{truncateAddress(b.token_address)}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {chainBadge(b.chain_id)}
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-[13px] font-mono text-zinc-900 tabular-nums">
                          ${b.live_rate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                        {livePrices[b.token] && livePrices[b.token] !== b.usd_rate && (
                          <p className="text-[9px] text-emerald-600">live</p>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-[13px] font-mono text-zinc-900 tabular-nums">
                          {formatBigNumber(b.allocated, b.decimals)} {b.token}
                        </p>
                        <p className="text-[10px] text-zinc-400 tabular-nums">
                          (${b.allocated_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-[13px] font-mono text-[#D97706] tabular-nums">
                          {formatBigNumber(b.spent, b.decimals)} {b.token}
                        </p>
                        <p className="text-[10px] text-zinc-400 tabular-nums">
                          (${b.spent_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <p className="text-[13px] font-mono text-[#15803D] tabular-nums">
                          {formatBigNumber(b.remaining, b.decimals)} {b.token}
                        </p>
                        <p className="text-[10px] text-zinc-400 tabular-nums">
                          (${b.remaining_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                        </p>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(b.utilization_pct, 100)}%`,
                                backgroundColor: b.utilization_pct > 80 ? "#DC2626" : b.utilization_pct > 50 ? "#D97706" : "#1652F0",
                              }}
                            />
                          </div>
                          <span className="text-[12px] font-mono text-zinc-500 tabular-nums w-12 text-right">
                            {b.utilization_pct.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBudget(b.token); }}
                          disabled={deletingBudget === b.token}
                          className="p-1 rounded-md text-zinc-300 hover:text-[#DC2626] hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
                          title={`Remove ${b.token} budget`}
                        >
                          {deletingBudget === b.token ? (
                            <Spinner size="sm" />
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
