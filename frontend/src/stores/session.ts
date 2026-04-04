import { create } from "zustand";
import { api } from "@/lib/api";

interface SessionState {
  org: string | null;
  team: string | null;
  workspace: string | null;
  project: string | null;
  runtimeKeyId: string | null;
  integrationKey: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  bootstrap: (org: string, project: string) => Promise<void>;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  org: null,
  team: null,
  workspace: null,
  project: null,
  runtimeKeyId: null,
  integrationKey: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  checkSession: async () => {
    set({ loading: true, error: null });
    try {
      const creds = await api.getCredentials();
      set({
        org: creds.org,
        team: creds.team,
        workspace: creds.workspace,
        project: creds.project,
        runtimeKeyId: creds.runtime_key_id,
        isAuthenticated: true,
        loading: false,
      });
    } catch {
      set({ isAuthenticated: false, loading: false });
    }
  },

  bootstrap: async (org: string, project: string) => {
    set({ loading: true, error: null });
    try {
      const result = await api.bootstrap({ org, project });
      set({
        org: result.org,
        team: result.team,
        workspace: result.workspace,
        project: result.project,
        integrationKey: result.integration_key,
        isAuthenticated: true,
        loading: false,
      });
    } catch (e: any) {
      set({ loading: false, error: e.message });
      throw e;
    }
  },

  clear: () =>
    set({
      org: null,
      team: null,
      workspace: null,
      project: null,
      runtimeKeyId: null,
      integrationKey: null,
      isAuthenticated: false,
    }),
}));
