const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.includes("/setup/")) {
      window.location.href = "/setup";
      throw new Error("Session expired. Redirecting to setup...");
    }
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Setup
  bootstrap: (data: { org: string; project: string }) =>
    request<{
      org: string;
      team: string;
      workspace: string;
      project: string;
      emus_registered: number;
      message: string;
      integration_key: string | null;
      integration_key_id: string | null;
    }>("/setup/bootstrap", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getIntegrationKey: () =>
    request<{ key_id: string; secret: string }>("/setup/integration-key"),

  regenerateKey: () =>
    request<{ key_id: string; secret: string }>("/setup/regenerate-key", { method: "POST" }),

  getCredentials: () =>
    request<{
      org: string;
      team: string;
      workspace: string;
      project: string;
      runtime_key_id: string;
    }>("/setup/credentials"),

  // EMUs
  listEmus: () => request<any[]>("/emus"),

  registerEmu: (emu: any) =>
    request("/emus", { method: "POST", body: JSON.stringify(emu) }),

  updateEmu: (key: string, emu: any) =>
    request(`/emus/${key}`, { method: "PUT", body: JSON.stringify(emu) }),

  updateEmuState: (key: string, enabled: boolean) =>
    request(`/emus/${key}/state`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),

  // Gate
  decide: (atoms: any[], decisionPoint = "ows-gate", agentId?: string) =>
    request<{
      allowed: boolean;
      reason_code: string | null;
      reason: string | null;
      emu_key: string | null;
      invocation_id: string;
      trace_id: string | null;
      budget_snapshot: {
        token: string;
        chain_id: string;
        token_address: string | null;
        decimals: number;
        remaining: string;
        spent: string;
        allocated: string;
        remaining_usd: number;
        spent_usd: number;
        allocated_usd: number;
        utilization_pct: number;
      } | null;
    }>("/gate/decide", {
      method: "POST",
      body: JSON.stringify({ atoms, decision_point: decisionPoint, agent_id: agentId || null }),
    }),

  // Composer
  draft: (description: string) =>
    request<{ emu: any; valid: boolean }>("/composer/draft", {
      method: "POST",
      body: JSON.stringify({ description }),
    }),

  refine: (existingEmu: any, instruction: string) =>
    request<{ emu: any; valid: boolean }>("/composer/refine", {
      method: "POST",
      body: JSON.stringify({ existing_emu: existingEmu, instruction }),
    }),

  // Prices
  getPrices: () => request<Record<string, number>>("/agents/prices"),

  // Agents
  listAgents: () => request<any[]>("/agents"),

  createAgent: (data: { name: string; eth_address: string }) =>
    request<any>("/agents", { method: "POST", body: JSON.stringify(data) }),

  getAgent: (id: string) => request<any>(`/agents/${id}`),

  updateAgent: (id: string, data: { name?: string; eth_address?: string }) =>
    request<any>(`/agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  deleteAgent: (id: string) =>
    request<any>(`/agents/${id}`, { method: "DELETE" }),

  listBudgets: (agentId: string) => request<any[]>(`/agents/${agentId}/budgets`),

  allocateBudget: (agentId: string, data: any) =>
    request<any>(`/agents/${agentId}/budgets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBudget: (agentId: string, token: string, data: any) =>
    request<any>(`/agents/${agentId}/budgets/${token}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteBudget: (agentId: string, token: string) =>
    request<any>(`/agents/${agentId}/budgets/${token}`, { method: "DELETE" }),

  // Traces
  listTraces: (limit = 50) => request<any[]>(`/traces?limit=${limit}`),

  getTrace: (id: string) => request<any>(`/traces/${id}`),
};
