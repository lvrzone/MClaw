/**
 * MCP (Model Context Protocol) Service
 * 标准 MCP 协议实现，支持启动外部 MCP 服务器
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { homedir } from 'os';

// MCP 服务器配置
export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
}

// MCP 工具定义
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// MCP 服务器实例
interface McpServerInstance {
  config: McpServerConfig;
  process: ChildProcess | null;
  tools: McpTool[];
  status: 'stopped' | 'starting' | 'running' | 'error';
  error?: string;
  requestId: number;
  pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>;
}

// 存储运行的服务器实例
const runningServers = new Map<string, McpServerInstance>();

// MCP 配置目录
const MCP_CONFIG_DIR = path.join(homedir(), '.mclaw', 'mcp');

/**
 * 获取默认 MCP 服务器配置
 */
export function getDefaultMcpServers(): McpServerConfig[] {
  return [
    {
      id: 'filesystem',
      name: '文件系统',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', homedir()],
      enabled: false,
      description: '安全的文件系统访问',
    },
    {
      id: 'github',
      name: 'GitHub',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
      enabled: false,
      description: 'GitHub API 访问',
    },
    {
      id: 'sqlite',
      name: 'SQLite',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sqlite'],
      enabled: false,
      description: 'SQLite 数据库操作',
    },
    {
      id: 'puppeteer',
      name: '浏览器自动化',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      enabled: false,
      description: '浏览器自动化和网页抓取',
    },
  ];
}

/**
 * 启动 MCP 服务器
 */
export async function startMcpServer(config: McpServerConfig): Promise<{ success: boolean; error?: string; tools?: McpTool[] }> {
  // 如果已经在运行，先停止
  await stopMcpServer(config.id);

  const instance: McpServerInstance = {
    config,
    process: null,
    tools: [],
    status: 'starting',
    requestId: 0,
    pendingRequests: new Map(),
  };

  runningServers.set(config.id, instance);

  try {
    // 启动子进程
    const child = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
      cwd: MCP_CONFIG_DIR,
    });

    instance.process = child;

    // 处理 stdout (JSON-RPC 响应)
    let buffer = '';
    child.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          handleMcpMessage(instance, line);
        }
      }
    });

    // 处理 stderr (日志)
    child.stderr?.on('data', (data: Buffer) => {
      console.log(`[MCP ${config.name}]`, data.toString().trim());
    });

    // 处理进程退出
    child.on('exit', (code) => {
      console.log(`[MCP ${config.name}] exited with code ${code}`);
      instance.status = 'stopped';
      instance.process = null;
      // 拒绝所有 pending 请求
      for (const [_, { reject }] of instance.pendingRequests) {
        reject(new Error('MCP server disconnected'));
      }
      instance.pendingRequests.clear();
    });

    // 发送 initialize 请求
    const initResult = await sendMcpRequest(instance, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'MClaw', version: '1.0.0' },
    });

    console.log(`[MCP ${config.name}] initialized:`, initResult);

    // 获取工具列表
    const toolsResult = await sendMcpRequest(instance, 'tools/list', {}) as { tools?: McpTool[] };
    instance.tools = toolsResult.tools || [];
    instance.status = 'running';

    console.log(`[MCP ${config.name}] loaded ${instance.tools.length} tools`);

    return { success: true, tools: instance.tools };
  } catch (error) {
    instance.status = 'error';
    instance.error = String(error);
    console.error(`[MCP ${config.name}] failed to start:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * 停止 MCP 服务器
 */
export async function stopMcpServer(serverId: string): Promise<void> {
  const instance = runningServers.get(serverId);
  if (!instance) return;

  if (instance.process) {
    instance.process.kill('SIGTERM');
    // 等待进程退出
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (instance.process?.killed) {
          clearInterval(checkInterval);
          resolve(undefined);
        }
      }, 100);
      // 超时强制杀死
      setTimeout(() => {
        clearInterval(checkInterval);
        instance.process?.kill('SIGKILL');
        resolve(undefined);
      }, 5000);
    });
  }

  runningServers.delete(serverId);
}

/**
 * 调用 MCP 工具
 */
export async function callMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const instance = runningServers.get(serverId);
  if (!instance) {
    return { success: false, error: `MCP server ${serverId} not running` };
  }

  if (instance.status !== 'running') {
    return { success: false, error: `MCP server ${serverId} is not ready` };
  }

  try {
    const result = await sendMcpRequest(instance, 'tools/call', {
      name: toolName,
      arguments: args,
    });

    return { success: true, result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * 获取所有运行中的服务器
 */
export function getRunningMcpServers(): Array<{ id: string; name: string; status: string; tools: McpTool[]; error?: string }> {
  return Array.from(runningServers.entries()).map(([id, instance]) => ({
    id,
    name: instance.config.name,
    status: instance.status,
    tools: instance.tools,
    error: instance.error,
  }));
}

/**
 * 发送 MCP JSON-RPC 请求
 */
function sendMcpRequest(instance: McpServerInstance, method: string, params: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!instance.process?.stdin) {
      reject(new Error('MCP server not connected'));
      return;
    }

    const requestId = ++instance.requestId;
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params,
    };

    instance.pendingRequests.set(requestId, { resolve, reject });

    // 发送请求
    instance.process.stdin.write(JSON.stringify(request) + '\n');

    // 设置超时
    setTimeout(() => {
      if (instance.pendingRequests.has(requestId)) {
        instance.pendingRequests.delete(requestId);
        reject(new Error('MCP request timeout'));
      }
    }, 30000);
  });
}

/**
 * 处理 MCP 消息
 */
function handleMcpMessage(instance: McpServerInstance, line: string): void {
  try {
    const message = JSON.parse(line);

    // 处理响应
    if (message.id !== undefined && instance.pendingRequests.has(message.id)) {
      const { resolve, reject } = instance.pendingRequests.get(message.id)!;
      instance.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'MCP error'));
      } else {
        resolve(message.result);
      }
    }

    // 处理通知
    if (message.method === 'notifications/tools/list_changed') {
      // 工具列表变化，重新获取
      sendMcpRequest(instance, 'tools/list', {}).then((result: { tools?: McpTool[] }) => {
        instance.tools = result.tools || [];
      }).catch(console.error);
    }
  } catch (error) {
    console.error('[MCP] failed to parse message:', error);
  }
}

/**
 * 停止所有 MCP 服务器
 */
export async function stopAllMcpServers(): Promise<void> {
  const ids = Array.from(runningServers.keys());
  await Promise.all(ids.map(stopMcpServer));
}
