import { create } from "zustand";
import { api } from "@/lib/api";

interface EmuState {
  emus: any[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  register: (emu: any) => Promise<void>;
  update: (key: string, emu: any) => Promise<void>;
  toggleState: (key: string, enabled: boolean) => Promise<void>;
}

export const useEmuStore = create<EmuState>((set, get) => ({
  emus: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const emus = await api.listEmus();
      set({ emus, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e.message });
    }
  },

  register: async (emu: any) => {
    await api.registerEmu(emu);
    await get().fetch();
  },

  update: async (key: string, emu: any) => {
    await api.updateEmu(key, emu);
    await get().fetch();
  },

  toggleState: async (key: string, enabled: boolean) => {
    await api.updateEmuState(key, enabled);
    await get().fetch();
  },
}));
