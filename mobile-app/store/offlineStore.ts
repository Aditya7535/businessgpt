import { create } from 'zustand';

interface OfflineState {
  isOnline: boolean;
  pendingAdjustmentsCount: number;
  lastSyncTime: string | null;
  setOnline: (status: boolean) => void;
  incrementPending: () => void;
  resetPending: () => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: true,
  pendingAdjustmentsCount: 0,
  lastSyncTime: new Date().toLocaleTimeString(),
  setOnline: (isOnline: boolean) => set({ isOnline, lastSyncTime: new Date().toLocaleTimeString() }),
  incrementPending: () => set((s) => ({ pendingAdjustmentsCount: s.pendingAdjustmentsCount + 1 })),
  resetPending: () => set({ pendingAdjustmentsCount: 0 }),
}));

export default useOfflineStore;
