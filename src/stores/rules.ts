/**
 * Rules Store - 编码规范状态管理
 * 使用文件系统存储 (.mclaw/rules.json)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Electron IPC 调用
async function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (typeof window !== 'undefined' && (window as any).electronAPI?.ipcRenderer?.invoke) {
    return (window as any).electronAPI.ipcRenderer.invoke(channel, ...args);
  }
  throw new Error('Electron IPC not available');
}

export interface Rule {
  id: string;
  name: string;
  content: string;
  category: 'style' | 'architecture' | 'security' | 'other';
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

interface RulesState {
  // 数据
  rules: Rule[];
  enabled: string[];
  isLoading: boolean;
  error: string | null;
  projectDir: string | null;
  globalEnabled: boolean;
  autoLoadProjectRules: boolean;

  // Actions
  loadRules: (projectDir?: string) => Promise<void>;
  addRule: (rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateRule: (id: string, updates: Partial<Rule>) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleRule: (id: string) => void;
  removeRule: (id: string) => void;
  enableRule: (id: string) => void;
  disableRule: (id: string) => void;
  getEnabledRules: () => Rule[];
  getRulesPrompt: () => Promise<string>;
  clearError: () => void;
  setGlobalEnabled: (enabled: boolean) => void;
  setAutoLoadProjectRules: (enabled: boolean) => void;
}

// 默认规则
const defaultRules: Rule[] = [
  {
    id: 'typescript-style',
    name: 'TypeScript 代码规范',
    content: `1. 使用 TypeScript 严格模式
2. 函数参数和返回值必须显式声明类型
3. 禁止使用 any 类型，使用 unknown 替代
4. 优先使用 interface 而不是 type 定义对象
5. 枚举使用 const enum 或对象字面量替代`,
    category: 'style',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'react-best-practice',
    name: 'React 最佳实践',
    content: `1. 函数组件使用 React.FC 或箭头函数
2. Hooks 必须在组件顶层调用
3. useEffect 依赖数组必须完整
4. 避免在 render 中创建新函数/对象
5. 使用 React.memo 优化性能`,
    category: 'architecture',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export const useRulesStore = create<RulesState>()(
  persist(
    (set, get) => ({
      // 初始状态
      rules: [],
      enabled: [],
      isLoading: false,
      error: null,
      projectDir: null,
      globalEnabled: true,
      autoLoadProjectRules: true,

      // 从文件系统加载规则
      loadRules: async (projectDir?: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await ipcInvoke<{ success: boolean; rules?: Record<string, unknown>; error?: string }>(
            'rules:get',
            projectDir
          );

          if (result.success && result.rules) {
            // 转换文件格式到 store 格式
            const fileRules = result.rules;
            const rules: Rule[] = [
              {
                id: 'file-rules',
                name: '项目编码规范',
                content: JSON.stringify(fileRules, null, 2),
                category: 'other',
                enabled: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ];
            set({ rules, enabled: ['file-rules'], isLoading: false, projectDir: projectDir || null });
          } else {
            // 使用默认规则
            set({ rules: defaultRules, enabled: defaultRules.map(r => r.id), isLoading: false });
          }
        } catch (error) {
          console.error('Failed to load rules:', error);
          // 使用默认规则
          set({ rules: defaultRules, enabled: defaultRules.map(r => r.id), isLoading: false });
        }
      },

      // 添加规则
      addRule: async (rule) => {
        const newRule: Rule = {
          ...rule,
          id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          rules: [...state.rules, newRule],
          enabled: [...state.enabled, newRule.id],
        }));

        // 同步到文件系统
        const { rules, projectDir } = get();
        await syncRulesToFile(rules, projectDir);
      },

      // 更新规则
      updateRule: async (id, updates) => {
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
          ),
        }));

        // 同步到文件系统
        const { rules, projectDir } = get();
        await syncRulesToFile(rules, projectDir);
      },

      // 删除规则
      deleteRule: async (id) => {
        set((state) => ({
          rules: state.rules.filter((r) => r.id !== id),
          enabled: state.enabled.filter((eid) => eid !== id),
        }));

        // 同步到文件系统
        const { rules, projectDir } = get();
        await syncRulesToFile(rules, projectDir);
      },

      // 切换规则启用状态
      toggleRule: (id) => {
        set((state) => {
          const isEnabled = state.enabled.includes(id);
          return {
            enabled: isEnabled
              ? state.enabled.filter((eid) => eid !== id)
              : [...state.enabled, id],
          };
        });
      },

      // 启用规则
      enableRule: (id) => {
        set((state) => ({
          enabled: state.enabled.includes(id) ? state.enabled : [...state.enabled, id],
        }));
      },

      // 禁用规则
      disableRule: (id) => {
        set((state) => ({
          enabled: state.enabled.filter((eid) => eid !== id),
        }));
      },

      // 删除规则（别名）
      removeRule: (id) => {
        get().deleteRule(id);
      },

      // 设置全局启用
      setGlobalEnabled: (enabled) => {
        set({ globalEnabled: enabled });
      },

      // 设置自动加载项目规则
      setAutoLoadProjectRules: (enabled) => {
        set({ autoLoadProjectRules: enabled });
      },

      // 获取启用的规则
      getEnabledRules: () => {
        const { rules, enabled } = get();
        return rules.filter((r) => enabled.includes(r.id));
      },

      // 获取规则提示词（用于 LLM）
      getRulesPrompt: async () => {
        const { projectDir } = get();
        try {
          const result = await ipcInvoke<{ success: boolean; prompt?: string; error?: string }>(
            'rules:prompt',
            projectDir
          );
          return result.success && result.prompt ? result.prompt : '';
        } catch (error) {
          console.error('Failed to get rules prompt:', error);
          return '';
        }
      },

      // 清除错误
      clearError: () => set({ error: null }),
    }),
    {
      name: 'mclaw-rules',
      partialize: (state) => ({ enabled: state.enabled }),
    }
  )
);

// 同步规则到文件系统
async function syncRulesToFile(rules: Rule[], projectDir: string | null) {
  try {
    // 合并所有规则内容
    const enabledRules = rules.filter(r => r.enabled);
    const rulesContent: Record<string, unknown> = {
      codeStyle: 'Custom',
      naming: {
        function: 'camelCase',
        class: 'PascalCase',
        variable: 'camelCase',
        constant: 'UPPER_CASE',
      },
      fileStructure: {},
      language: 'JavaScript/TypeScript',
      framework: 'React',
      customRules: enabledRules.map(r => ({
        name: r.name,
        category: r.category,
        content: r.content,
      })),
    };

    await ipcInvoke('rules:update', { rules: rulesContent, projectDir });
  } catch (error) {
    console.error('Failed to sync rules to file:', error);
  }
}
