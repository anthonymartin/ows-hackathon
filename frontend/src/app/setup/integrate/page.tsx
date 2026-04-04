"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { useSessionStore } from "@/stores/session";
import { api } from "@/lib/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-all duration-150 cursor-pointer"
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="w-7 h-7 rounded-full bg-[#1652F0] flex items-center justify-center flex-shrink-0">
      <span className="text-[12px] font-bold text-white tabular-nums">{n}</span>
    </div>
  );
}

function CollapsibleSection({
  children,
  previewLines = 6,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  previewLines?: number;
  defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  // Approximate line height for code blocks is ~20px
  const previewHeight = previewLines * 20 + 16; // +padding

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
        style={{ maxHeight: expanded ? "5000px" : `${previewHeight}px` }}
      >
        {children}
      </div>
      {!expanded && (
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative z-10 mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold text-[#1652F0] bg-[#F0F3FF] hover:bg-[#E0E7FF] transition-colors cursor-pointer"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2.5"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

function generateExecutable(studioUrl: string): string {
  return `#!/usr/bin/env python3
"""
OWS Policy Executable — Memrail Policy Studio Gateway

OWS pipes a PolicyContext JSON to stdin (with policy_config injected from
the policy file's "config" field). This executable forwards the request to
the Policy Studio backend, which handles:

  - EVM transaction decoding (raw_hex → to, value, data)
  - Agent lookup by wallet address → budget enrichment
  - Wei → USD conversion for budget triggers
  - Memrail AMI decide call
  - Atomic budget decrement on ALLOW

The executable itself is intentionally thin — all dynamic logic lives
server-side so it can evolve without redeploying policy files.
"""
import json, sys, urllib.request

POLICY_ID = "memrail-policy-gate"


def emit(allow, reason=None):
    r = {"allow": allow, "policy_id": POLICY_ID}
    if reason:
        r["reason"] = reason
    json.dump(r, sys.stdout)
    sys.exit(0)


ctx = json.load(sys.stdin)
config = ctx.get("policy_config", {})

STUDIO_URL = config.get("studio_url", "${studioUrl}")
API_KEY = config.get("api_key")

if not API_KEY:
    emit(False, "api_key not set in policy_config")

# ── Parse raw_hex for EVM chains (OWS doesn't parse to/value/data yet) ──
tx = ctx.get("transaction", {}) or {}
to_addr = tx.get("to")
value_wei = tx.get("value")
tx_data = tx.get("data")

if not to_addr and tx.get("raw_hex"):
    try:
        raw = bytes.fromhex(tx["raw_hex"].replace("0x", ""))
        if raw[0] == 0x02:
            raw = raw[1:]  # strip EIP-1559 type byte

        def rlp_list(b):
            if b[0] <= 0xF7:
                length, off = b[0] - 0xC0, 1
            else:
                ll = b[0] - 0xF7
                length, off = int.from_bytes(b[1:1+ll], "big"), 1 + ll
            items, pos = [], off
            while pos < off + length:
                if b[pos] <= 0x7F:
                    items.append(b[pos:pos+1]); pos += 1
                elif b[pos] <= 0xB7:
                    l = b[pos] - 0x80
                    items.append(b[pos+1:pos+1+l]); pos += 1 + l
                elif b[pos] <= 0xBF:
                    ll = b[pos] - 0xB7
                    l = int.from_bytes(b[pos+1:pos+1+ll], "big")
                    items.append(b[pos+1+ll:pos+1+ll+l]); pos += 1 + ll + l
                else:
                    break
            return items

        f = rlp_list(raw)
        # EIP-1559: [chainId, nonce, maxPri, maxFee, gas, to, value, data, ...]
        # Legacy:   [nonce, gasPrice, gas, to, value, data, ...]
        if len(f) >= 8:
            to_addr = ("0x" + f[5].hex()) if f[5] else None
            value_wei = str(int.from_bytes(f[6], "big")) if f[6] else "0"
            tx_data = ("0x" + f[7].hex()) if f[7] else "0x"
        elif len(f) >= 6:
            to_addr = ("0x" + f[3].hex()) if f[3] else None
            value_wei = str(int.from_bytes(f[4], "big")) if f[4] else "0"
            tx_data = ("0x" + f[5].hex()) if f[5] else "0x"
    except Exception:
        pass  # Triggers requiring these fields simply won't match

# ── Build request for Policy Studio ──────────────────────────
spending = ctx.get("spending", {}) or {}

body = {
    "chain_id": ctx.get("chain_id", ""),
    "wallet_id": ctx.get("wallet_id", ""),
    "api_key_id": ctx.get("api_key_id", ""),
    "transaction": {
        "to": to_addr,
        "value": value_wei,
        "raw_hex": tx.get("raw_hex", ""),
        "data": tx_data,
    },
    "spending": {
        "daily_total": spending.get("daily_total", "0"),
        "date": spending.get("date", ""),
    },
    "usd_rate": config.get("usd_rate", 0),
    "decimals": config.get("decimals", 18),
    "decision_point": config.get("decision_point", "ows-gate"),
    "wallet_address": config.get("wallet_address"),
    "agent_id": config.get("agent_id"),
}

try:
    req = urllib.request.Request(
        f"{STUDIO_URL}/api/gate/ows-decide",
        data=json.dumps(body).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
    )
    resp = json.load(urllib.request.urlopen(req, timeout=4))
    emit(resp.get("allow", False), resp.get("reason"))
except Exception as e:
    emit(False, f"Studio error: {e}")
`;
}

function generatePolicyJson(studioUrl: string, apiKey: string): string {
  return JSON.stringify(
    {
      id: "memrail-policy-gate",
      name: "Memrail Policy Engine",
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      rules: [
        {
          type: "allowed_chains",
          chain_ids: ["eip155:8453", "eip155:84532"],
        },
      ],
      executable: "~/.ows/policies/memrail_gate.py",
      config: {
        studio_url: studioUrl,
        api_key: apiKey,
        decision_point: "ows-gate",
        usd_rate: 2500.0,
        decimals: 18,
        wallet_address: null,
        agent_id: null,
      },
      action: "deny",
    },
    null,
    2,
  );
}

function generateCliCommands(): string {
  return `# Save the policy executable
cp memrail_gate.py ~/.ows/policies/
chmod +x ~/.ows/policies/memrail_gate.py

# Create the policy (stores to ~/.ows/policies/memrail-policy-gate.json)
ows policy create --file memrail-policy.json

# Create an API key with the policy attached
ows key create \\
  --name "my-agent" \\
  --wallet agent-treasury \\
  --policy memrail-policy-gate`;
}

export default function IntegratePage() {
  const router = useRouter();
  const { workspace, project, integrationKey: sessionKey } = useSessionStore();
  const studioUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const [apiKey, setApiKey] = useState<string>(sessionKey || "");
  const [keyId, setKeyId] = useState<string>("");
  const [loadingKey, setLoadingKey] = useState(!sessionKey);
  const [regenerating, setRegenerating] = useState(false);

  const fetchKey = useCallback(async () => {
    try {
      setLoadingKey(true);
      const result = await api.getIntegrationKey();
      setApiKey(result.secret);
      setKeyId(result.key_id);
    } catch {
      // No key found — will show placeholder
    } finally {
      setLoadingKey(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionKey) {
      fetchKey();
    } else {
      setApiKey(sessionKey);
      setLoadingKey(false);
    }
  }, [sessionKey, fetchKey]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await api.regenerateKey();
      setApiKey(result.secret);
      setKeyId(result.key_id);
    } catch {
      // handle error silently
    } finally {
      setRegenerating(false);
    }
  }

  const hasKey = !!apiKey;
  const keyResolved = !loadingKey;

  const executableCode = generateExecutable(studioUrl);
  const policyJson = generatePolicyJson(studioUrl, hasKey ? apiKey : "YOUR_MEMRAIL_API_KEY");
  const cliCommands = generateCliCommands();

  return (
    <Shell title="Integrate" subtitle="Connect OWS to your policy engine">
      <div className="max-w-3xl mx-auto space-y-8 pb-12">
        {/* Hero */}
        <div className="animate-fade-up">
          <Card>
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-2xl bg-[#F0F3FF] border border-[#C7D2FE] flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#1652F0]" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-zinc-900 tracking-[-0.02em]">
                  OWS Executable Policy
                </h3>
                <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed max-w-xl">
                  OWS pipes a <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">PolicyContext</code> JSON
                  to the executable&apos;s stdin. The policy file&apos;s <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">config</code> object
                  is injected as <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">policy_config</code> at
                  runtime — this is where Memrail credentials and context mappings live. The executable decodes
                  the raw transaction, maps fields to context, calls Memrail decide, and writes
                  a <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">PolicyResult</code> to stdout.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Integration Key Callout */}
        {hasKey && (
          <div className="animate-fade-up">
            <Card>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h4 className="text-[13px] font-semibold text-zinc-900 tracking-[-0.01em]">
                      Integration API Key
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyButton text={apiKey} />
                    <button
                      onClick={handleRegenerate}
                      disabled={regenerating}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 transition-all duration-150 cursor-pointer disabled:opacity-50"
                    >
                      <svg className={`w-3 h-3 ${regenerating ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                      </svg>
                      {regenerating ? "Regenerating..." : "Regenerate"}
                    </button>
                  </div>
                </div>
                <div className="font-mono text-[12px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 break-all select-all">
                  {apiKey}
                </div>
                {keyId && (
                  <p className="text-[11px] text-zinc-400 font-mono">
                    Key ID: {keyId}
                  </p>
                )}
                <p className="text-[11px] text-amber-600 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  This key is workspace-scoped. Store it securely and do not share it publicly.
                </p>
              </div>
            </Card>
          </div>
        )}

        {loadingKey && !hasKey && (
          <div className="animate-fade-up">
            <Card>
              <div className="flex items-center gap-3 py-2">
                <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                <span className="text-[13px] text-zinc-500">Loading integration key...</span>
              </div>
            </Card>
          </div>
        )}

        {/* Step 1 — Executable */}
        <div className="animate-fade-up stagger-1" style={{ opacity: 0 }}>
          <div className="flex items-center gap-3 mb-3">
            <StepNumber n={1} />
            <div>
              <h4 className="text-[14px] font-semibold text-zinc-900 tracking-[-0.01em]">
                Policy Executable
              </h4>
              <p className="text-[12px] text-zinc-400 mt-0.5">
                Save as <code className="px-1 py-0.5 rounded bg-zinc-100 text-[11px] font-mono text-zinc-600">~/.ows/policies/memrail_gate.py</code>
              </p>
            </div>
            <div className="ml-auto">
              <CopyButton text={executableCode} />
            </div>
          </div>
          <CollapsibleSection previewLines={8}>
            <CodeBlock language="json">{executableCode}</CodeBlock>
          </CollapsibleSection>
        </div>

        {/* Step 2 — Policy JSON */}
        <div className="animate-fade-up stagger-2" style={{ opacity: 0 }}>
          <div className="flex items-center gap-3 mb-3">
            <StepNumber n={2} />
            <div>
              <h4 className="text-[14px] font-semibold text-zinc-900 tracking-[-0.01em]">
                Policy Definition
              </h4>
              <p className="text-[12px] text-zinc-400 mt-0.5">
                Save as <code className="px-1 py-0.5 rounded bg-zinc-100 text-[11px] font-mono text-zinc-600">memrail-policy.json</code>
                {!keyResolved ? (
                  <> — loading key...</>
                ) : hasKey ? (
                  <> — API key is pre-filled</>
                ) : (
                  <> — replace <code className="px-1 py-0.5 rounded bg-zinc-100 text-[11px] font-mono text-zinc-600">YOUR_MEMRAIL_API_KEY</code> with your key</>
                )}
              </p>
            </div>
            <div className="ml-auto">
              <CopyButton text={policyJson} />
            </div>
          </div>
          <CollapsibleSection previewLines={8}>
            <CodeBlock language="json">{policyJson}</CodeBlock>
          </CollapsibleSection>
        </div>

        {/* Step 3 — CLI */}
        <div className="animate-fade-up stagger-3" style={{ opacity: 0 }}>
          <div className="flex items-center gap-3 mb-3">
            <StepNumber n={3} />
            <div>
              <h4 className="text-[14px] font-semibold text-zinc-900 tracking-[-0.01em]">
                Install &amp; Attach
              </h4>
              <p className="text-[12px] text-zinc-400 mt-0.5">
                Register the policy and create an API key scoped to it
              </p>
            </div>
            <div className="ml-auto">
              <CopyButton text={cliCommands} />
            </div>
          </div>
          <CodeBlock language="json">{cliCommands}</CodeBlock>
        </div>

        {/* Config explanation */}
        <div className="animate-fade-up stagger-4" style={{ opacity: 0 }}>
          <Card>
            <div className="space-y-4">
              <h4 className="text-[13px] font-semibold text-zinc-900 tracking-[-0.01em]">
                How it works
              </h4>
              <CollapsibleSection previewLines={4}>
                <div className="space-y-4">
                  <p className="text-[13px] text-zinc-500 leading-relaxed">
                    OWS injects the policy file&apos;s <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">config</code> as <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">policy_config</code> into
                    the JSON piped to stdin. The executable decodes <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">transaction.raw_hex</code> (RLP)
                    to extract <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">to</code>, <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">value</code>, and <code className="px-1.5 py-0.5 rounded bg-zinc-100 text-[12px] font-mono text-zinc-700">data</code> since
                    OWS currently only populates the raw hex in the signing path.
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      ["api_key", "Your workspace-scoped Memrail API key"],
                      ["workspace / project", "Memrail org scope for EMU evaluation"],
                      ["usd_rate", "Token-to-USD conversion rate (e.g., 2500 for ETH)"],
                      ["decimals", "Token decimals for wei conversion (18 for ETH)"],
                      ["decision_point", "Gate identifier matching your EMU triggers"],
                      ["extra_context", "Static context injected on every request"],
                    ].map(([key, desc]) => (
                      <div key={key} className="flex items-start gap-2 py-1">
                        <code className="text-[11px] font-mono text-[#1652F0] bg-[#F0F3FF] px-1.5 py-0.5 rounded flex-shrink-0">
                          {key}
                        </code>
                        <span className="text-[12px] text-zinc-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          </Card>
        </div>

        {/* Context mapping reference */}
        <div className="animate-fade-up stagger-5" style={{ opacity: 0 }}>
          <Card>
            <div className="space-y-4">
              <h4 className="text-[13px] font-semibold text-zinc-900 tracking-[-0.01em]">
                Context Mapping
              </h4>
              <CollapsibleSection previewLines={4}>
                <div className="space-y-4">
                  <p className="text-[13px] text-zinc-500">
                    The executable maps OWS PolicyContext fields to Memrail context:
                  </p>
                  <div className="rounded-xl overflow-hidden border border-zinc-800/50">
                    <table className="w-full text-[12px] font-mono">
                      <thead>
                        <tr className="bg-[#1A1D24] text-zinc-400">
                          <th className="text-left px-4 py-2.5 font-medium">OWS Field</th>
                          <th className="text-left px-4 py-2.5 font-medium">Memrail Context</th>
                        </tr>
                      </thead>
                      <tbody className="bg-[#1E2028]">
                        {[
                          ["chain_id", "state.chain_id"],
                          ["wallet_id", "state.wallet_id"],
                          ["api_key_id", "state.api_key_id"],
                          ["transaction.raw_hex → to", "state.request.to"],
                          ["transaction.raw_hex → value", "state.request.value"],
                          ["value (wei → USD)", "state.request.amount"],
                          ["spending.daily_total", "state.spending.daily_total"],
                          ["daily_total (wei → USD)", "state.budget.daily_spent"],
                        ].map(([ows, atom], i) => (
                          <tr key={i} className="border-t border-zinc-700/30">
                            <td className="px-4 py-2 text-zinc-400">{ows}</td>
                            <td className="px-4 py-2 text-[#73DACA]">{atom}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleSection>
            </div>
          </Card>
        </div>

        {/* CTA */}
        <div className="flex gap-3 animate-fade-up" style={{ animationDelay: "300ms", opacity: 0 }}>
          <Button onClick={() => router.push("/inbox")} size="lg" className="flex-1">
            Continue to Policies
          </Button>
          <Button onClick={() => router.push("/composer")} variant="secondary" size="lg" className="flex-1">
            Create a Policy
          </Button>
        </div>
      </div>
    </Shell>
  );
}
