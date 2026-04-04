"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CodeBlock } from "@/components/ui/code-block";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useEmuStore } from "@/stores/emus";

function DeployConfirmation({
  emuKey,
  intent,
  trigger,
  isAllow,
  onGoToInbox,
  onCreateAnother,
}: {
  emuKey: string;
  intent: string;
  trigger: string;
  isAllow: boolean;
  onGoToInbox: () => void;
  onCreateAnother: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-deploy-backdrop bg-black/30">
      <div className="animate-deploy-card w-full max-w-md mx-4">
        <div className="rounded-2xl border-2 border-[#16A34A]/25 bg-white overflow-hidden shadow-2xl shadow-[#16A34A]/10">
          {/* Hero section */}
          <div className="relative px-8 pt-12 pb-8 text-center overflow-hidden">
            {/* Subtle radial glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#F0FDF4] via-[#F0FDF4]/60 to-transparent" />

            {/* Animated icon */}
            <div className="relative">
              {/* Pulsing ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-2 border-[#16A34A]/20 animate-deploy-ring" />
              </div>

              {/* Shield icon */}
              <div className="animate-deploy-icon relative mx-auto w-20 h-20">
                <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center shadow-lg shadow-[#16A34A]/30 relative animate-deploy-shimmer">
                  <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" stroke="currentColor">
                    <path className="animate-deploy-check" strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              </div>
            </div>

            <h2 className="relative text-[32px] font-bold tracking-[-0.04em] text-[#15803D] mt-6 leading-none animate-fade-in" style={{ animationDelay: "500ms", opacity: 0 }}>
              Policy Deployed
            </h2>

            <p className="relative text-[14px] text-zinc-500 mt-2.5 leading-relaxed animate-fade-in" style={{ animationDelay: "650ms", opacity: 0 }}>
              {intent || "Your policy is now enforcing decisions"}
            </p>
          </div>

          {/* Details */}
          <div className="border-t border-[#E2E4E9] px-8 py-5 animate-fade-in" style={{ animationDelay: "750ms", opacity: 0 }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-1">EMU Key</p>
                <p className="text-[13px] font-mono text-zinc-900 font-semibold">{emuKey}</p>
              </div>
              <div className="flex items-start justify-end">
                <Badge variant={isAllow ? "allow" : "deny"} dot>
                  {isAllow ? "Allow" : "Deny"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Trigger preview */}
          <div className="border-t border-[#E2E4E9] px-8 py-5 animate-fade-in" style={{ animationDelay: "850ms", opacity: 0 }}>
            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider mb-2">Trigger</p>
            <CodeBlock language="dsl">{trigger}</CodeBlock>
          </div>

          {/* CTA */}
          <div className="px-8 py-5 space-y-2.5 animate-fade-in" style={{ animationDelay: "950ms", opacity: 0 }}>
            <Button onClick={onGoToInbox} className="w-full" size="lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5V6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25v6.75m-19.5 0v4.5A2.25 2.25 0 004.5 20.25h15a2.25 2.25 0 002.25-2.25v-4.5" />
              </svg>
              View in Inbox
            </Button>
            <Button onClick={onCreateAnother} variant="secondary" className="w-full" size="lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Another
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComposerPage() {
  const router = useRouter();
  const { register } = useEmuStore();
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [description, setDescription] = useState("");
  const [manualJson, setManualJson] = useState("");
  const [emu, setEmu] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refineInput, setRefineInput] = useState("");
  const [deployed, setDeployed] = useState<any>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.draft(description);
      setEmu(result.emu);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!emu || !refineInput) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.refine(emu, refineInput);
      setEmu(result.emu);
      setRefineInput("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    const toRegister = mode === "manual" ? JSON.parse(manualJson) : emu;
    if (!toRegister) return;
    setSaving(true);
    setError(null);
    try {
      await register(toRegister);
      setDeployed(toRegister);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const isAllow = emu?.action?.tool?.tool_id?.endsWith(".allow");

  return (
    <Shell title="Composer" subtitle="Author policies with AI">
      {/* Deploy success overlay */}
      {deployed && (
        <DeployConfirmation
          emuKey={deployed.emu_key || "policy"}
          intent={deployed.intent || ""}
          trigger={deployed.trigger || ""}
          isAllow={deployed.action?.tool?.tool_id?.endsWith(".allow") ?? false}
          onGoToInbox={() => router.push("/inbox")}
          onCreateAnother={() => {
            setDeployed(null);
            setEmu(null);
            setDescription("");
            setManualJson("");
            setError(null);
          }}
        />
      )}

      <div className="mb-6">
        <Tabs
          tabs={[
            { key: "ai", label: "AI Composer" },
            { key: "manual", label: "Manual" },
          ]}
          active={mode}
          onChange={(k) => setMode(k as "ai" | "manual")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left — Input */}
        <div className="space-y-4 animate-fade-up">
          {mode === "ai" ? (
            <Card>
              <div className="space-y-5">
                <div>
                  <h3 className="text-[14px] font-semibold text-zinc-900 tracking-[-0.01em]">
                    Describe your policy
                  </h3>
                  <p className="text-[12px] text-zinc-400 mt-0.5">
                    Natural language in, deterministic EMU out.
                  </p>
                </div>

                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Deny any transaction over $10,000 from unverified operators"
                  rows={4}
                />

                <Button onClick={handleGenerate} loading={loading} disabled={!description.trim()}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Generate
                </Button>

                {emu && (
                  <>
                    <div className="h-px bg-[#EFF0F3]" />
                    <div className="space-y-3">
                      <Textarea
                        id="refine"
                        label="Refine"
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        placeholder="e.g., Lower the threshold to $5,000"
                        rows={2}
                      />
                      <Button
                        variant="secondary"
                        onClick={handleRefine}
                        loading={loading}
                        disabled={!refineInput.trim()}
                      >
                        Refine
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="space-y-4">
                <h3 className="text-[14px] font-semibold text-zinc-900 tracking-[-0.01em]">
                  EMU JSON
                </h3>
                <Textarea
                  id="manual-json"
                  value={manualJson}
                  onChange={(e) => setManualJson(e.target.value)}
                  placeholder='{"emu_key": "...", "intent": "...", "trigger": "...", ...}'
                  rows={18}
                  className="font-mono !text-[12px]"
                />
                <Button onClick={handleRegister} loading={saving} disabled={!manualJson.trim() || !!deployed}>
                  Deploy Policy
                </Button>
              </div>
            </Card>
          )}

          {error && (
            <div className="rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3">
              <p className="text-[13px] text-[#B91C1C]">{error}</p>
            </div>
          )}
        </div>

        {/* Right — Preview */}
        <div className="space-y-4 animate-fade-up stagger-2" style={{ opacity: 0 }}>
          {loading && !emu ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Spinner size="lg" />
                <p className="text-[13px] text-zinc-400">Generating policy...</p>
              </div>
            </Card>
          ) : emu ? (
            <Card
              header={
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-zinc-900 tracking-[-0.01em]">Preview</span>
                  <Badge variant={isAllow ? "allow" : "deny"} dot>
                    {isAllow ? "Allow" : "Deny"}
                  </Badge>
                </div>
              }
            >
              <div className="space-y-5 animate-fade-up">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Key</p>
                    <p className="text-[13px] font-mono text-zinc-900 font-medium">{emu.emu_key}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Priority</p>
                    <p className="text-[13px] font-mono text-zinc-900 tabular-nums font-medium">{emu.priority}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Intent</p>
                  <p className="text-[13px] text-zinc-600 leading-relaxed">{emu.intent}</p>
                </div>

                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-2">Trigger</p>
                  <CodeBlock language="dsl">{emu.trigger}</CodeBlock>
                </div>

                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-2">Full Definition</p>
                  <CodeBlock language="json">
                    {JSON.stringify(emu, null, 2)}
                  </CodeBlock>
                </div>

                <div className="pt-2">
                  <Button onClick={handleRegister} loading={saving} disabled={!!deployed} className="w-full" size="lg">
                    Deploy Policy
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-[13px] text-zinc-400 font-medium">
                {mode === "ai" ? "Policy preview will appear here" : "Enter EMU JSON to register"}
              </p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
