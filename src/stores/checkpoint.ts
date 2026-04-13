/**
 * Checkpoint Store - 文件修改历史状态管理
 */
import { create } from 'zustand';
import {
  type Checkpoint,
  type CheckpointGroup,
  type DiffResult,
  getAllCheckpointsGrouped,
  getCheckpointsForFile,
  rollbackToCheckpoint,
  deleteCheckpoint,
  clearAllCheckpoints,
  diffCheckpointWithCurrent,
} from '@/lib/checkpoint';

interface CheckpointState {
  // 数据
  groups: CheckpointGroup[];
  currentFilePath: string | null;
  currentFileCheckpoints: Checkpoint[];
  selectedCheckpoint: Checkpoint | null;
  diffResult: DiffResult | null;
  
  // UI 状态
  isPanelOpen: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  init: () => Promise<void>;
  refreshGroups: () => Promise<void>;
  selectFile: (filePath: string | null) => Promise<void>;
  selectCheckpoint: (checkpoint: Checkpoint | null) => Promise<void>;
  rollback: (checkpointId: string) => Promise<boolean>;
  deleteCheckpointById: (checkpointId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

export const useCheckpointStore = create<CheckpointState>((set, get) => ({
  // 初始状态
  groups: [],
  currentFilePath: null,
  currentFileCheckpoints: [],
  selectedCheckpoint: null,
  diffResult: null,
  isPanelOpen: false,
  isLoading: false,
  error: null,

  init: async () => {
    await get().refreshGroups();
  },

  refreshGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      const groups = await getAllCheckpointsGrouped();
      set({ groups, isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  selectFile: async (filePath) => {
    if (!filePath) {
      set({
        currentFilePath: null,
        currentFileCheckpoints: [],
        selectedCheckpoint: null,
        diffResult: null,
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const checkpoints = await getCheckpointsForFile(filePath);
      set({
        currentFilePath: filePath,
        currentFileCheckpoints: checkpoints,
        selectedCheckpoint: checkpoints[0] || null,
        isLoading: false,
      });
      
      // 自动加载第一个 checkpoint 的 diff
      if (checkpoints[0]) {
        await get().selectCheckpoint(checkpoints[0]);
      }
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  selectCheckpoint: async (checkpoint) => {
    if (!checkpoint) {
      set({ selectedCheckpoint: null, diffResult: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const diffResult = await diffCheckpointWithCurrent(checkpoint);
      set({
        selectedCheckpoint: checkpoint,
        diffResult,
        isLoading: false,
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  rollback: async (checkpointId) => {
    set({ isLoading: true, error: null });
    try {
      const success = await rollbackToCheckpoint(checkpointId);
      if (success) {
        // 刷新当前文件的 checkpoints
        const { currentFilePath } = get();
        if (currentFilePath) {
          await get().selectFile(currentFilePath);
        }
        await get().refreshGroups();
      }
      set({ isLoading: false });
      return success;
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  deleteCheckpointById: async (checkpointId) => {
    set({ isLoading: true, error: null });
    try {
      await deleteCheckpoint(checkpointId);
      
      // 刷新状态
      const { currentFilePath, selectedCheckpoint } = get();
      if (selectedCheckpoint?.id === checkpointId) {
        set({ selectedCheckpoint: null, diffResult: null });
      }
      if (currentFilePath) {
        await get().selectFile(currentFilePath);
      }
      await get().refreshGroups();
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  clearAll: async () => {
    set({ isLoading: true, error: null });
    try {
      await clearAllCheckpoints();
      set({
        groups: [],
        currentFilePath: null,
        currentFileCheckpoints: [],
        selectedCheckpoint: null,
        diffResult: null,
        isLoading: false,
      });
    } catch (error) {
      set({ error: String(error), isLoading: false });
      throw error;
    }
  },

  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
}));
