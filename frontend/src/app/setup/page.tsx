"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/layout/shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/stores/session";

export default function SetupPage() {
  const router = useRouter();
  const { bootstrap, loading, error } = useSessionStore();
  const [org, setOrg] = useState("ows");
  const [project, setProject] = useState("default");
  const [result, setResult] = useState<any>(null);

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    try {
      await bootstrap(org, project);
      setResult({ org, project });
    } catch {
      // error is set in store — integration key stored in session by bootstrap()
    }
  }

  return (
    <Shell title="Setup" subtitle="Initialize your gate project">
      <div className="max-w-lg mx-auto mt-8">
        {!result ? (
          <div className="animate-fade-up">
            <Card>
              <div className="space-y-6">
                <div>
                  <h3 className="text-[16px] font-semibold text-zinc-900 tracking-[-0.02em]">
                    Bootstrap Project
                  </h3>
                  <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed">
                    Create your organization, workspace, and starter policies in one step.
                  </p>
                </div>

                <div className="h-px bg-[#EFF0F3]" />

                <form onSubmit={handleBootstrap} className="space-y-5">
                  <Input
                    id="org"
                    label="Organization"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="ows"
                  />
                  <Input
                    id="project"
                    label="Project"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    placeholder="default"
                  />

                  {error && (
                    <div className="rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-4 py-3">
                      <p className="text-[13px] text-[#B91C1C]">{error}</p>
                    </div>
                  )}

                  <Button type="submit" loading={loading} size="lg" className="w-full">
                    Initialize
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-up">
            <Card>
              <div className="text-center space-y-4 py-4">
                <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-[#16A34A]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-zinc-900 tracking-[-0.02em]">
                    Project Ready
                  </h3>
                  <p className="text-[13px] text-zinc-500 mt-1">
                    {result.emus_registered || 5} starter policies deployed to your gate.
                  </p>
                </div>
              </div>
            </Card>

            <Button onClick={() => router.push("/setup/integrate")} size="lg" className="w-full">
              Set Up OWS Integration
            </Button>

            <Button onClick={() => router.push("/inbox")} variant="secondary" size="lg" className="w-full">
              Skip to Policies
            </Button>
          </div>
        )}
      </div>
    </Shell>
  );
}
