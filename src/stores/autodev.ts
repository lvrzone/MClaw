/**
 * AutoDev Store - 自动开发系统
 * 支持代码分析、自动重构、批量操作、版本控制、任务队列
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { hostApiFetch } from '@/lib/host-api';

// 文件分析结果
export interface FileAnalysis {
  path: string;
  type: 'file' | 'directory';
  size: number;
  lines: number;
  language?: string;
  complexity?: number;
  issues: CodeIssue[];
  dependencies: string[];
  exports: string[];
  imports: string[];
}

// 代码问题
export interface CodeIssue {
  type: 'error' | 'warning' | 'suggestion';
  line: number;
  column: number;
  message: string;
  rule?: string;
  fix?: string;
}

// 重构任务
export interface RefactorTask {
  id: string;
  type: 'rename' | 'extract' | 'move' | 'delete' | 'format' | 'custom';
  target: string;
  description: string;
  changes: FileChange[];
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
  createdAt: number;
  completedAt?: number;
}

// 文件变更
export interface FileChange {
  path: string;
  operation: 'create' | 'modify' | 'delete' | 'rename';
  originalContent?: string;
  newContent?: string;
  originalPath?: string;
}

// 批量操作
export interface BatchOperation {
  id: string;
  name: string;
  pattern: string; // glob pattern
  operation: 'replace' | 'delete' | 'format' | 'custom';
  config: Record<string, unknown>;
  affectedFiles: string[];
  status: 'pending' | 'running' | 'completed' | 'error';
  progress: number;
  createdAt: number;
}

// Git 操作
export interface GitOperation {
  id: string;
  type: 'commit' | 'push' | 'pull' | 'branch' | 'merge';
  message?: string;
  branch?: string;
  files: string[];
  status: 'pending' | 'running' | 'completed' | 'error';
  output?: string;
  error?: string;
  createdAt: number;
}

// 任务队列项
export interface TaskQueueItem {
  id: string;
  type: 'analysis' | 'refactor' | 'batch' | 'git';
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'paused';
  progress: number;
  data: unknown;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// 项目分析结果
export interface ProjectAnalysis {
  path: string;
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  complexity: number;
  issues: {
    errors: number;
    warnings: number;
    suggestions: number;
  };
  dependencies: string[];
  structure: DirectoryNode;
}

// 目录节点
export interface DirectoryNode {
  name: string;
  path: string;
  type: 'directory';
  children: (DirectoryNode | FileNode)[];
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file';
  size: number;
  language: string;
}

interface AutoDevState {
  // 当前分析的项目
  currentProject: string | null;
  
  // 分析结果
  projectAnalysis: ProjectAnalysis | null;
  fileAnalyses: Record<string, FileAnalysis>;
  
  // 任务
  refactorTasks: RefactorTask[];
  batchOperations: BatchOperation[];
  gitOperations: GitOperation[];
  
  // 任务队列
  taskQueue: TaskQueueItem[];
  isProcessing: boolean;
  
  // Actions
  setCurrentProject: (path: string) => void;
  
  // 代码分析
  analyzeProject: (path: string) => Promise<ProjectAnalysis>;
  analyzeFile: (path: string) => Promise<FileAnalysis>;
  
  // 重构
  createRefactorTask: (task: Omit<RefactorTask, 'id' | 'status' | 'createdAt'>) => string;
  executeRefactor: (taskId: string) => Promise<void>;
  
  // 批量操作
  createBatchOperation: (op: Omit<BatchOperation, 'id' | 'status' | 'progress' | 'affectedFiles' | 'createdAt'>) => string;
  executeBatch: (opId: string) => Promise<void>;
  
  // Git 操作
  createGitOperation: (op: Omit<GitOperation, 'id' | 'status' | 'createdAt'>) => string;
  executeGit: (opId: string) => Promise<void>;
  
  // 任务队列
  addToQueue: (item: Omit<TaskQueueItem, 'id' | 'status' | 'progress' | 'createdAt'>) => string;
  removeFromQueue: (id: string) => void;
  startQueue: () => void;
  pauseQueue: () => void;
  clearQueue: () => void;
  
  // 状态管理
  clearCompleted: () => void;
}

export const useAutoDevStore = create<AutoDevState>()(
  persist(
    (set, get) => ({
      currentProject: null,
      projectAnalysis: null,
      fileAnalyses: {},
      refactorTasks: [],
      batchOperations: [],
      gitOperations: [],
      taskQueue: [],
      isProcessing: false,

      setCurrentProject: (path) => set({ currentProject: path }),

      // 分析项目
      analyzeProject: async (path) => {
        try {
          const response = await hostApiFetch<ProjectAnalysis>(
            `/api/autodev/analyze/project?path=${encodeURIComponent(path)}`
          );
          set({ projectAnalysis: response });
          return response;
        } catch (error) {
          console.error('[AutoDev] 项目分析失败:', error);
          throw error;
        }
      },

      // 分析文件
      analyzeFile: async (path) => {
        try {
          const response = await hostApiFetch<FileAnalysis>(
            `/api/autodev/analyze/file?path=${encodeURIComponent(path)}`
          );
          set((state) => ({
            fileAnalyses: { ...state.fileAnalyses, [path]: response },
          }));
          return response;
        } catch (error) {
          console.error('[AutoDev] 文件分析失败:', error);
          throw error;
        }
      },

      // 创建重构任务
      createRefactorTask: (task) => {
        const id = `refactor-${Date.now()}`;
        const newTask: RefactorTask = {
          ...task,
          id,
          status: 'pending',
          createdAt: Date.now(),
        };
        set((state) => ({
          refactorTasks: [...state.refactorTasks, newTask],
        }));
        return id;
      },

      // 执行重构
      executeRefactor: async (taskId) => {
        const task = get().refactorTasks.find((t) => t.id === taskId);
        if (!task) return;

        set((state) => ({
          refactorTasks: state.refactorTasks.map((t) =>
            t.id === taskId ? { ...t, status: 'running' } : t
          ),
        }));

        try {
          await hostApiFetch('/api/autodev/refactor', {
            method: 'POST',
            body: JSON.stringify({ taskId, task }),
          });

          set((state) => ({
            refactorTasks: state.refactorTasks.map((t) =>
              t.id === taskId
                ? { ...t, status: 'completed', completedAt: Date.now() }
                : t
            ),
          }));
        } catch (error) {
          set((state) => ({
            refactorTasks: state.refactorTasks.map((t) =>
              t.id === taskId
                ? { ...t, status: 'error', error: String(error) }
                : t
            ),
          }));
        }
      },

      // 创建批量操作
      createBatchOperation: (op) => {
        const id = `batch-${Date.now()}`;
        const newOp: BatchOperation = {
          ...op,
          id,
          status: 'pending',
          progress: 0,
          affectedFiles: [],
          createdAt: Date.now(),
        };
        set((state) => ({
          batchOperations: [...state.batchOperations, newOp],
        }));
        return id;
      },

      // 执行批量操作
      executeBatch: async (opId) => {
        const op = get().batchOperations.find((o) => o.id === opId);
        if (!op) return;

        set((state) => ({
          batchOperations: state.batchOperations.map((o) =>
            o.id === opId ? { ...o, status: 'running' } : o
          ),
        }));

        try {
          await hostApiFetch('/api/autodev/batch', {
            method: 'POST',
            body: JSON.stringify({ opId, operation: op }),
          });

          set((state) => ({
            batchOperations: state.batchOperations.map((o) =>
              o.id === opId
                ? { ...o, status: 'completed', progress: 100 }
                : o
            ),
          }));
        } catch (error) {
          set((state) => ({
            batchOperations: state.batchOperations.map((o) =>
              o.id === opId
                ? { ...o, status: 'error', error: String(error) }
                : o
            ),
          }));
        }
      },

      // 创建 Git 操作
      createGitOperation: (op) => {
        const id = `git-${Date.now()}`;
        const newOp: GitOperation = {
          ...op,
          id,
          status: 'pending',
          createdAt: Date.now(),
        };
        set((state) => ({
          gitOperations: [...state.gitOperations, newOp],
        }));
        return id;
      },

      // 执行 Git 操作
      executeGit: async (opId) => {
        const op = get().gitOperations.find((o) => o.id === opId);
        if (!op) return;

        set((state) => ({
          gitOperations: state.gitOperations.map((o) =>
            o.id === opId ? { ...o, status: 'running' } : o
          ),
        }));

        try {
          const response = await hostApiFetch<{ output: string }>('/api/autodev/git', {
            method: 'POST',
            body: JSON.stringify({ opId, operation: op }),
          });

          set((state) => ({
            gitOperations: state.gitOperations.map((o) =>
              o.id === opId
                ? { ...o, status: 'completed', output: response.output }
                : o
            ),
          }));
        } catch (error) {
          set((state) => ({
            gitOperations: state.gitOperations.map((o) =>
              o.id === opId
                ? { ...o, status: 'error', error: String(error) }
                : o
            ),
          }));
        }
      },

      // 添加到队列
      addToQueue: (item) => {
        const id = `queue-${Date.now()}`;
        const newItem: TaskQueueItem = {
          ...item,
          id,
          status: 'pending',
          progress: 0,
          createdAt: Date.now(),
        };
        set((state) => ({
          taskQueue: [...state.taskQueue, newItem],
        }));
        return id;
      },

      // 从队列移除
      removeFromQueue: (id) => {
        set((state) => ({
          taskQueue: state.taskQueue.filter((i) => i.id !== id),
        }));
      },

      // 开始队列处理
      startQueue: () => {
        set({ isProcessing: true });
        // 队列处理逻辑由组件或 hook 实现
      },

      // 暂停队列
      pauseQueue: () => {
        set({ isProcessing: false });
      },

      // 清空队列
      clearQueue: () => {
        set({ taskQueue: [], isProcessing: false });
      },

      // 清空已完成
      clearCompleted: () => {
        set((state) => ({
          refactorTasks: state.refactorTasks.filter((t) => t.status === 'running'),
          batchOperations: state.batchOperations.filter((o) => o.status === 'running'),
          gitOperations: state.gitOperations.filter((o) => o.status === 'running'),
          taskQueue: state.taskQueue.filter((i) => i.status === 'pending' || i.status === 'running'),
        }));
      },
    }),
    {
      name: 'autodev-storage',
      partialize: (state) => ({
        currentProject: state.currentProject,
        refactorTasks: state.refactorTasks,
        batchOperations: state.batchOperations,
        gitOperations: state.gitOperations,
      }),
    }
  )
);
