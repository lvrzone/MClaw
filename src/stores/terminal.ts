/**
 * Terminal Panel Store
 * 管理终端面板的全局状态
 */
import { create } from 'zustand';

interface TerminalState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
