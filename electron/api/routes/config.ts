import type { IncomingMessage, ServerResponse } from 'http';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import { getOpenClawConfigDir, ensureDir, expandPath } from '../../utils/paths';

export async function handleConfigRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  // GET /api/config/openclaw - 读取 openclaw.json
  if (url.pathname === '/api/config/openclaw' && req.method === 'GET') {
    try {
      const openclawPath = join(getOpenClawConfigDir(), 'openclaw.json');
      if (existsSync(openclawPath)) {
        const content = readFileSync(openclawPath, 'utf-8');
        sendJson(res, 200, { content });
      } else {
        sendJson(res, 200, { content: '{}' });
      }
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // PUT /api/config/openclaw - 保存 openclaw.json
  if (url.pathname === '/api/config/openclaw' && req.method === 'PUT') {
    try {
      const body = await parseJsonBody<{ content: string }>(req);
      const openclawPath = join(getOpenClawConfigDir(), 'openclaw.json');
      ensureDir(getOpenClawConfigDir());
      
      // 验证 JSON 格式
      if (body.content) {
        JSON.parse(body.content);
      }
      
      writeFileSync(openclawPath, body.content, 'utf-8');
      
      // 通知 Gateway 重启以应用更改
      if (ctx.gatewayManager.getStatus().state !== 'stopped') {
        ctx.gatewayManager.debouncedReload();
      }
      
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // GET /api/config/agent/:id/file/:filename - 读取 Agent 配置文件
  // 注意：排除 /workspace 路径，避免与 workspace API 冲突
  if (url.pathname.startsWith('/api/config/agent/') && 
      url.pathname.includes('/file/') && 
      req.method === 'GET') {
    try {
      const match = url.pathname.match(/^\/api\/config\/agent\/([^/]+)\/file\/(.+)$/);
      if (!match) {
        sendJson(res, 400, { success: false, error: 'Invalid path format' });
        return true;
      }

      const agentId = decodeURIComponent(match[1]);
      const fileName = decodeURIComponent(match[2]);
      
      // Agent 配置文件可能在多个位置：
      // 1. workspace/{fileName} (main agent 默认)
      // 2. workspace-{agentId}/{fileName} (其他 agent 或 main agent 新格式)
      // 3. agents/{agentId}/agent/{fileName} (旧格式 agentDir)
      const configDir = getOpenClawConfigDir();
      const mainWorkspacePath = join(configDir, 'workspace', fileName);
      const newWorkspacePath = join(configDir, `workspace-${agentId}`, fileName);
      const oldAgentDirPath = join(configDir, 'agents', agentId, 'agent', fileName);
      const oldWorkspacePath = join(configDir, 'agents', agentId, fileName);
      
      let content: string | null = null;
      let foundPath = '';

      // 按优先级查找文件
      if (existsSync(mainWorkspacePath)) {
        content = readFileSync(mainWorkspacePath, 'utf-8');
        foundPath = mainWorkspacePath;
      } else if (existsSync(newWorkspacePath)) {
        content = readFileSync(newWorkspacePath, 'utf-8');
        foundPath = newWorkspacePath;
      } else if (existsSync(oldAgentDirPath)) {
        content = readFileSync(oldAgentDirPath, 'utf-8');
        foundPath = oldAgentDirPath;
      } else if (existsSync(oldWorkspacePath)) {
        content = readFileSync(oldWorkspacePath, 'utf-8');
        foundPath = oldWorkspacePath;
      }

      if (content !== null) {
        sendJson(res, 200, { content, path: foundPath });
      } else {
        sendJson(res, 200, { content: null, path: null });
      }
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // POST /api/config/agent/:id/file/:filename - 保存 Agent 配置文件
  // 注意：排除 /workspace 路径，避免与 workspace API 冲突
  if (url.pathname.startsWith('/api/config/agent/') && 
      url.pathname.includes('/file/') && 
      req.method === 'POST') {
    try {
      const match = url.pathname.match(/^\/api\/config\/agent\/([^/]+)\/file\/(.+)$/);
      if (!match) {
        sendJson(res, 400, { success: false, error: 'Invalid path format' });
        return true;
      }

      const agentId = decodeURIComponent(match[1]);
      const fileName = decodeURIComponent(match[2]);
      const body = await parseJsonBody<{ content: string }>(req);
      
      const configDir = getOpenClawConfigDir();
      let workspaceDir: string;
      
      // main agent 使用 workspace/ 目录，其他 agent 使用 workspace-{agentId}/
      if (agentId === 'main') {
        workspaceDir = join(configDir, 'workspace');
      } else {
        workspaceDir = join(configDir, `workspace-${agentId}`);
      }
      
      ensureDir(workspaceDir);
      
      const filePath = join(workspaceDir, fileName);
      writeFileSync(filePath, body.content, 'utf-8');
      
      sendJson(res, 200, { success: true, path: filePath });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // GET /api/config/files - 获取可用的配置文件列表
  if (url.pathname === '/api/config/files' && req.method === 'GET') {
    try {
      const files: Array<{ name: string; path: string; type: 'json' | 'markdown'; category: 'system' | 'agent' | 'workspace' }> = [];
      const configDir = getOpenClawConfigDir();

      // 系统配置文件
      const openclawPath = join(configDir, 'openclaw.json');
      if (existsSync(openclawPath)) {
        files.push({
          name: 'openclaw.json',
          path: openclawPath,
          type: 'json',
          category: 'system',
        });
      }

      // Cron 配置
      const cronPath = join(configDir, 'cron', 'cron.json');
      if (existsSync(cronPath)) {
        files.push({
          name: 'cron.json',
          path: cronPath,
          type: 'json',
          category: 'system',
        });
      }

      // Agent workspaces - 扫描所有工作区目录
      try {
        const { readdirSync } = await import('fs');
        
        // 扫描 workspace 目录 (main agent)
        const mainWorkspaceDir = join(configDir, 'workspace');
        if (existsSync(mainWorkspaceDir)) {
          try {
            const mainFiles = readdirSync(mainWorkspaceDir);
            for (const file of mainFiles) {
              if (file.endsWith('.md') || file.endsWith('.json')) {
                files.push({
                  name: file,
                  path: join(mainWorkspaceDir, file),
                  type: file.endsWith('.json') ? 'json' : 'markdown',
                  category: 'agent',
                });
              }
            }
          } catch {
            // 忽略无法读取的目录
          }
        }
        
        // 扫描 workspace-{agentId} 目录 (其他 agent)
        const entries = readdirSync(configDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith('workspace-')) {
            const agentId = entry.name.replace('workspace-', '');
            const workspaceDir = join(configDir, entry.name);
            try {
              const mdFiles = readdirSync(workspaceDir);
              for (const mdFile of mdFiles) {
                if (mdFile.endsWith('.md') || mdFile.endsWith('.json')) {
                  files.push({
                    name: mdFile,
                    path: join(workspaceDir, mdFile),
                    type: mdFile.endsWith('.json') ? 'json' : 'markdown',
                    category: 'agent',
                  });
                }
              }
            } catch {
              // 忽略无法读取的目录
            }
          }
        }
      } catch {
        // 忽略目录读取错误
      }

      sendJson(res, 200, { files });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  // GET /api/config/agent/:id/workspace - 获取 Agent 工作区路径
  if (url.pathname.match(/^\/api\/config\/agent\/([^/]+)\/workspace$/) && req.method === 'GET') {
    try {
      const match = url.pathname.match(/^\/api\/config\/agent\/([^/]+)\/workspace$/);
      if (!match) {
        sendJson(res, 400, { success: false, error: 'Invalid path format' });
        return true;
      }

      const agentId = decodeURIComponent(match[1]);
      const configDir = getOpenClawConfigDir();
      
      console.log(`[Config API] /api/config/agent/${agentId}/workspace called`);
      
      // main agent 使用 workspace/，其他 agent 使用 workspace-{agentId}/
      let workspacePath: string;
      if (agentId === 'main') {
        workspacePath = join(configDir, 'workspace');
      } else {
        workspacePath = join(configDir, `workspace-${agentId}`);
      }
      
      const expandedPath = expandPath(workspacePath);
      const exists = existsSync(workspacePath);
      
      console.log(`[Config API] workspacePath: ${workspacePath}`);
      console.log(`[Config API] expandedPath: ${expandedPath}`);
      console.log(`[Config API] exists: ${exists}`);
      
      sendJson(res, 200, { 
        path: workspacePath, 
        expandedPath,
        exists,
        agentId 
      });
    } catch (error) {
      console.error('[Config API] Error:', error);
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
