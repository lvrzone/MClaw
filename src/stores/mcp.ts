/**
 * MCP Store - Model Context Protocol 外部工具管理
 * 支持连接外部工具服务（如浏览器、数据库、搜索等）
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface McpServer {
  id: string;
  name: string;
  command: string; // 启动命令，如 "npx -y @anthropic/mcp-server-browser"
  args?: string[]; // 命令参数
  env?: Record<string, string>; // 环境变量
  enabled: boolean;
  status: 'stopped' | 'starting' | 'running' | 'error';
  errorMessage?: string;
  tools: McpTool[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpCall {
  id: string;
  serverId: string;
  toolName: string;
  input: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  output?: string;
  error?: string;
  startTime: number;
  endTime?: number;
}

interface McpState {
  // MCP 服务器列表
  servers: McpServer[];
  // 是否启用 MCP
  enabled: boolean;
  // 调用历史
  calls: McpCall[];
  
  // Actions
  addServer: (server: Omit<McpServer, 'id' | 'status' | 'tools'>) => void;
  updateServer: (id: string, updates: Partial<McpServer>) => void;
  removeServer: (id: string) => void;
  toggleServer: (id: string) => void;
  setEnabled: (enabled: boolean) => void;
  
  // 服务器管理
  startServer: (id: string) => Promise<void>;
  stopServer: (id: string) => Promise<void>;
  restartServer: (id: string) => Promise<void>;
  
  // 工具调用
  callTool: (serverId: string, toolName: string, input: Record<string, unknown>) => Promise<McpCall>;
  
  // 获取所有可用工具
  getAllTools: () => Array<{ server: McpServer; tool: McpTool }>;
  
  // 清除历史
  clearCalls: () => void;
}

// 预设的 MCP 服务器配置
export const PRESET_SERVERS: Array<{
  name: string;
  command: string;
  args?: string[];
  description: string;
}> = [
  {
    name: 'Browser (Puppeteer)',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-puppeteer'],
    description: '浏览器自动化，支持网页截图、点击、表单填写等',
  },
  {
    name: 'SQLite',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-sqlite'],
    description: 'SQLite 数据库操作',
  },
  {
    name: 'GitHub',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-github'],
    description: 'GitHub API 操作（需要 GITHUB_TOKEN）',
  },
  {
    name: 'Filesystem',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-server-filesystem', '/path/to/allowed/dir'],
    description: '文件系统操作（需要指定允许访问的目录）',
  },
];

export const useMcpStore = create<McpState>()(
  persist(
    (set, get) => ({
      servers: [],
      enabled: false,
      calls: [],

      addServer: (server) => {
        const newServer: McpServer = {
          ...server,
          id: `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          status: 'stopped',
          tools: [],
        };
        set((state) => ({
          servers: [...state.servers, newServer],
        }));
      },

      updateServer: (id, updates) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      removeServer: (id) => {
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== id),
        }));
      },

      toggleServer: (id) => {
        const server = get().servers.find((s) => s.id === id);
        if (server) {
          if (server.enabled) {
            get().stopServer(id);
          } else {
            get().startServer(id);
          }
        }
      },

      setEnabled: (enabled) => {
        set({ enabled });
      },

      startServer: async (id) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === id ? { ...s, status: 'starting', errorMessage: undefined } : s
          ),
        }));

        // TODO: 实际实现需要通过后端 Gateway 启动 MCP 服务器进程
        // 这里模拟启动过程
        setTimeout(() => {
          set((state) => ({
            servers: state.servers.map((s) =>
              s.id === id
                ? {
                    ...s,
                    status: 'running',
                    enabled: true,
                    tools: [
                      {
                        name: 'example_tool',
                        description: '示例工具',
                        inputSchema: { type: 'object', properties: {} },
                      },
                    ],
                  }
                : s
            ),
          }));
        }, 1000);
      },

      stopServer: async (id) => {
        // TODO: 实际实现需要通过后端 Gateway 停止 MCP 服务器进程
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === id
              ? { ...s, status: 'stopped', enabled: false, tools: [] }
              : s
          ),
        }));
      },

      restartServer: async (id) => {
        await get().stopServer(id);
        await get().startServer(id);
      },

      callTool: async (serverId, toolName, input) => {
        const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const call: McpCall = {
          id: callId,
          serverId,
          toolName,
          input,
          status: 'running',
          startTime: Date.now(),
        };

        set((state) => ({
          calls: [call, ...state.calls],
        }));

        // TODO: 实际实现需要通过后端 Gateway 调用 MCP 工具
        // 这里模拟调用过程
        return new Promise((resolve) => {
          setTimeout(() => {
            const completedCall: McpCall = {
              ...call,
              status: 'success',
              output: 'Tool execution result (simulated)',
              endTime: Date.now(),
            };
            set((state) => ({
              calls: state.calls.map((c) =>
                c.id === callId ? completedCall : c
              ),
            }));
            resolve(completedCall);
          }, 2000);
        });
      },

      getAllTools: () => {
        const { servers } = get();
        const tools: Array<{ server: McpServer; tool: McpTool }> = [];
        for (const server of servers) {
          if (server.enabled && server.status === 'running') {
            for (const tool of server.tools) {
              tools.push({ server, tool });
            }
          }
        }
        return tools;
      },

      clearCalls: () => {
        set({ calls: [] });
      },
    }),
    {
      name: 'mclaw-mcp',
      partialize: (state) => ({
        servers: state.servers,
        enabled: state.enabled,
      }),
    }
  )
);
