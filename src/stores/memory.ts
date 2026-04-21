/**
 * Memory Store - 项目记忆管理
 * 使用 Electron IPC 与主进程通信，存储在 .mclaw/memory.json
 */

import { create } from 'zustand';

export interface MemoryData {
  userPreferences: {
    codeStyle: string;
    favoriteFramework: string;
    avoid: string[];
  };
  projectContext: {
    techStack: string[];
    dependencies: string[];
    recentOperations: string[];
  };
}

interface MemoryState {
  memory: MemoryData | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadMemory: (projectDir?: string) => Promise<void>;
  updateMemory: (updates: Partial<MemoryData>, projectDir?: string) => Promise<boolean>;
  getMemoryPrompt: (projectDir?: string) => Promise<string>;
  addRecentOperation: (operation: string, projectDir?: string) => Promise<void>;
}

// Electron IPC 调用
async function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.ipcRenderer?.invoke) {
    return (window as any).electronAPI.ipcRenderer.invoke(channel, ...args);
  }
  throw new Error('Electron IPC not available');
}

const DEFAULT_MEMORY: MemoryData = {
  userPreferences: {
    codeStyle: '简洁、高效、可维护',
    favoriteFramework: 'React',
    avoid: ['var关键字', '嵌套过深', '冗余注释'],
  },
  projectContext: {
    techStack: [],
    dependencies: [],
    recentOperations: [],
  },
};

export const useMemoryStore = create<MemoryState>((set, get) => ({
  memory: null,
  isLoading: false,
  error: null,

  loadMemory: async (projectDir?: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await ipcInvoke<{ success: boolean; memory?: MemoryData; error?: string }>(
        'memory:get',
        projectDir
      );
      if (result.success && result.memory) {
        set({ memory: result.memory, isLoading: false });
      } else {
        set({ memory: DEFAULT_MEMORY, isLoading: false });
      }
    } catch (error) {
      set({ error: String(error), isLoading: false, memory: DEFAULT_MEMORY });
    }
  },

  updateMemory: async (updates: Partial<MemoryData>, projectDir?: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await ipcInvoke<{ success: boolean; message?: string; error?: string }>(
        'memory:update',
        { updates, projectDir }
      );
      if (result.success) {
        // Reload memory to get updated state
        await get().loadMemory(projectDir);
        set({ isLoading: false });
        return true;
      } else {
        set({ error: result.error || '更新失败', isLoading: false });
        return false;
      }
    } catch (error) {
      set({ error: String(error), isLoading: false });
      return false;
    }
  },

  getMemoryPrompt: async (projectDir?: string) => {
    try {
      const result = await ipcInvoke<{ success: boolean; prompt?: string; error?: string }>(
        'memory:prompt',
        projectDir
      );
      return result.success ? result.prompt || '' : '';
    } catch (error) {
      console.error('Failed to get memory prompt:', error);
      return '';
    }
  },

  addRecentOperation: async (operation: string, projectDir?: string) => {
    const { memory } = get();
    if (!memory) return;

    const updatedOperations = [...memory.projectContext.recentOperations, operation];
    // Keep only last 20 operations
    if (updatedOperations.length > 20) {
      updatedOperations.shift();
    }

    await get().updateMemory(
      {
        projectContext: {
          ...memory.projectContext,
          recentOperations: updatedOperations,
        },
      },
      projectDir
    );
  },
}));
