import { create } from "zustand";
import { api } from "@/lib/api";

export interface Agent {
  id: string;
  org: string;
  name: string;
  eth_address: string;
  created_at: string;
}

export interface AgentBudget {
  agent_id: string;
  token: string;
  token_address: string | null;
  chain_id: string;
  decimals: number;
  allocated: string;
  spent: string;
  daily_limit: string | null;
  daily_spent: string;
  usd_rate: number;
  remaining: string;
  remaining_usd: number;
  allocated_usd: number;
  spent_usd: number;
  utilization_pct: number;
}

interface AgentState {
  agents: Agent[];
  selectedAgent: Agent | null;
  budgets: AgentBudget[];
  loading: boolean;
  error: string | null;
  fetchAgents: () => Promise<void>;
  createAgent: (name: string, eth_address: string) => Promise<Agent>;
  selectAgent: (agent: Agent | null) => void;
  fetchBudgets: (agentId: string) => Promise<void>;
  allocateBudget: (agentId: string, data: any) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  selectedAgent: null,
  budgets: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const agents = await api.listAgents();
      set({ agents, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  createAgent: async (name: string, eth_address: string) => {
    const agent = await api.createAgent({ name, eth_address });
    await get().fetchAgents();
    return agent;
  },

  selectAgent: (agent: Agent | null) => {
    set({ selectedAgent: agent, budgets: [] });
  },

  fetchBudgets: async (agentId: string) => {
    try {
      const budgets = await api.listBudgets(agentId);
      set({ budgets });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  allocateBudget: async (agentId: string, data: any) => {
    await api.allocateBudget(agentId, data);
    await get().fetchBudgets(agentId);
  },
}));
