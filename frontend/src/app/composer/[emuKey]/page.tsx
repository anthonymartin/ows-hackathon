"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { CodeBlock } from "@/components/ui/code-block";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useEmuStore } from "@/stores/emus";

export default function EditEmuPage() {
  const params = useParams();
  const router = useRouter();
  const emuKey = params.emuKey as string;
  const { emus, fetch, update, toggleState } = useEmuStore();
  const [emu, setEmu] = useState<any>(null);
  const [refineInput, setRefineInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    const found = emus.find((e) => e.emu_key === emuKey);
    if (found) setEmu(found);
  }, [emus, emuKey]);

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

  async function handleSave() {
    if (!emu) return;
    setSaving(true);
    setError(null);
    try {
      await update(emuKey, emu);
      router.push("/inbox");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!emu) return;
    try {
      await toggleState(emuKey, !emu.enabled);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!emu) {
    return (
      <Shell title="Edit Policy">
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </Shell>
    );
  }

  const isAllow = emu.action?.tool?.tool_id?.endsWith(".allow");

  return (
    <Shell title={emuKey} subtitle="Edit policy">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left — Controls */}
        <div className="space-y-4 animate-fade-up">
          <Card>
            <div className="space-y-5">
              <div>
                <h3 className="text-[14px] font-semibold text-zinc-900 tracking-[-0.01em]">
                  Refine with AI
                </h3>
                <p className="text-[12px] text-zinc-400 mt-0.5">
                  Describe the change in natural language.
                </p>
              </div>
              <Textarea
                id="refine"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                placeholder="e.g., Also check for expired vendor certifications"
                rows={3}
              />
              <Button onClick={handleRefine} loading={loading} disabled={!refineInput.trim()}>
                Refine
              </Button>
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <h3 className="text-[14px] font-semibold text-zinc-900 tracking-[-0.01em]">
                Actions
              </h3>
              <div className="flex gap-2">
                <Button onClick={handleSave} loading={saving}>
                  Save Changes
                </Button>
                <Button variant="secondary" onClick={handleToggle}>
                  {emu.enabled ? "Disable" : "Enable"}
                </Button>
                <Button variant="ghost" onClick={() => router.push("/inbox")}>
                  Cancel
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

        {/* Right — Preview */}
        <div className="animate-fade-up stagger-2" style={{ opacity: 0 }}>
          <Card
            header={
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-mono font-semibold text-zinc-900">{emuKey}</span>
                <div className="flex items-center gap-2">
                  <Badge variant={emu.enabled ? "active" : "draft"} dot>
                    {emu.enabled ? "Active" : "Disabled"}
                  </Badge>
                  <Badge variant={isAllow ? "allow" : "deny"} dot>
                    {isAllow ? "Allow" : "Deny"}
                  </Badge>
                </div>
              </div>
            }
          >
            <div className="space-y-5">
              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Intent</p>
                <p className="text-[13px] text-zinc-600 leading-relaxed">{emu.intent}</p>
              </div>

              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-2">Trigger</p>
                <CodeBlock language="dsl">{emu.trigger}</CodeBlock>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Priority</p>
                  <p className="text-[13px] font-mono text-zinc-900 tabular-nums font-medium">{emu.priority}</p>
                </div>
                <div>
                  <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-1">Reason Code</p>
                  <p className="text-[13px] font-mono text-zinc-600">{emu.action?.tool?.args?.reason_code || "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider mb-2">Full Definition</p>
                <CodeBlock language="json">{JSON.stringify(emu, null, 2)}</CodeBlock>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
