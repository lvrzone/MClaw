import type { IncomingMessage, ServerResponse } from 'http';
import { join } from 'node:path';
import { getOpenClawConfigDir } from '../../utils/paths';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';

const SAFE_SESSION_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export async function handleSessionRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  _ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/sessions/transcript' && req.method === 'GET') {
    try {
      const agentId = url.searchParams.get('agentId')?.trim() || '';
      const sessionId = url.searchParams.get('sessionId')?.trim() || '';
      if (!agentId || !sessionId) {
        sendJson(res, 400, { success: false, error: 'agentId and sessionId are required' });
        return true;
      }
      if (!SAFE_SESSION_SEGMENT.test(agentId) || !SAFE_SESSION_SEGMENT.test(sessionId)) {
        sendJson(res, 400, { success: false, error: 'Invalid transcript identifier' });
        return true;
      }

      const transcriptPath = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions', `${sessionId}.jsonl`);
      const fsP = await import('node:fs/promises');
      const raw = await fsP.readFile(transcriptPath, 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      const messages = lines.flatMap((line) => {
        try {
          const entry = JSON.parse(line) as { type?: string; message?: unknown };
          return entry.type === 'message' && entry.message ? [entry.message] : [];
        } catch {
          return [];
        }
      });

      sendJson(res, 200, { success: true, messages });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        sendJson(res, 404, { success: false, error: 'Transcript not found' });
      } else {
        sendJson(res, 500, { success: false, error: 'Failed to load transcript' });
      }
    }
    return true;
  }

  // 获取会话上下文使用情况
  if (url.pathname === '/api/sessions/context' && req.method === 'GET') {
    try {
      const agentId = url.searchParams.get('agentId')?.trim() || '';
      const sessionId = url.searchParams.get('sessionId')?.trim() || '';
      if (!agentId || !sessionId) {
        sendJson(res, 400, { success: false, error: 'agentId and sessionId are required' });
        return true;
      }

      const transcriptPath = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions', `${sessionId}.jsonl`);
      const fsP = await import('node:fs/promises');
      
      let totalChars = 0;
      let totalTokens = 0;
      let messageCount = 0;
      
      try {
        const raw = await fsP.readFile(transcriptPath, 'utf8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        
        messageCount = lines.length;
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.type === 'message' && entry.message) {
              const msg = entry.message as { content?: string | unknown[] };
              if (typeof msg.content === 'string') {
                totalChars += msg.content.length;
              } else if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                  if (typeof part === 'object' && part !== null && 'text' in part) {
                    totalChars += String((part as { text: string }).text).length;
                  }
                }
              }
            }
          } catch {
            // Skip malformed lines
          }
        }
        
        // 粗略估算 token 数 (中文字符约 2 tokens，英文约 0.25 tokens)
        totalTokens = Math.round(totalChars * 0.4);
      } catch {
        // File might not exist yet
      }

      // 常见模型的上下文窗口限制
      const contextLimits: Record<string, number> = {
        'gpt-4': 128000,
        'gpt-4o': 128000,
        'gpt-4-turbo': 128000,
        'gpt-3.5-turbo': 16385,
        'claude-3-opus': 200000,
        'claude-3-sonnet': 200000,
        'claude-3-haiku': 200000,
        'claude-2': 100000,
        'gemini-pro': 128000,
        'default': 128000,
      };

      // 获取 Agent 的模型配置
      let modelContextLimit = contextLimits['default'];
      try {
        const agentConfigPath = join(getOpenClawConfigDir(), 'agents', agentId, 'agent.json');
        const agentConfigRaw = await fsP.readFile(agentConfigPath, 'utf8');
        const agentConfig = JSON.parse(agentConfigRaw);
        const modelRef = agentConfig.modelRef || '';
        
        // 尝试匹配模型
        for (const [model, limit] of Object.entries(contextLimits)) {
          if (modelRef.toLowerCase().includes(model.toLowerCase())) {
            modelContextLimit = limit;
            break;
          }
        }
      } catch {
        // Use default limit
      }

      const usedPercent = Math.min(100, Math.round((totalTokens / modelContextLimit) * 100));

      sendJson(res, 200, { 
        success: true, 
        messageCount,
        totalChars,
        totalTokens,
        contextLimit: modelContextLimit,
        usedPercent,
        modelContextLimit 
      });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/sessions/delete' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ sessionKey: string }>(req);
      const sessionKey = body.sessionKey;
      if (!sessionKey || !sessionKey.startsWith('agent:')) {
        sendJson(res, 400, { success: false, error: `Invalid sessionKey: ${sessionKey}` });
        return true;
      }
      const parts = sessionKey.split(':');
      if (parts.length < 3) {
        sendJson(res, 400, { success: false, error: `sessionKey has too few parts: ${sessionKey}` });
        return true;
      }
      const agentId = parts[1];
      const sessionsDir = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions');
      const sessionsJsonPath = join(sessionsDir, 'sessions.json');
      const fsP = await import('node:fs/promises');
      const raw = await fsP.readFile(sessionsJsonPath, 'utf8');
      const sessionsJson = JSON.parse(raw) as Record<string, unknown>;

      let uuidFileName: string | undefined;
      let resolvedSrcPath: string | undefined;
      if (Array.isArray(sessionsJson.sessions)) {
        const entry = (sessionsJson.sessions as Array<Record<string, unknown>>)
          .find((s) => s.key === sessionKey || s.sessionKey === sessionKey);
        if (entry) {
          uuidFileName = (entry.file ?? entry.fileName ?? entry.path) as string | undefined;
          if (!uuidFileName && typeof entry.id === 'string') {
            uuidFileName = `${entry.id}.jsonl`;
          }
        }
      }
      if (!uuidFileName && sessionsJson[sessionKey] != null) {
        const val = sessionsJson[sessionKey];
        if (typeof val === 'string') {
          uuidFileName = val;
        } else if (typeof val === 'object' && val !== null) {
          const entry = val as Record<string, unknown>;
          const absFile = (entry.sessionFile ?? entry.file ?? entry.fileName ?? entry.path) as string | undefined;
          if (absFile) {
            if (absFile.startsWith('/') || absFile.match(/^[A-Za-z]:\\/)) {
              resolvedSrcPath = absFile;
            } else {
              uuidFileName = absFile;
            }
          } else {
            const uuidVal = (entry.id ?? entry.sessionId) as string | undefined;
            if (uuidVal) uuidFileName = uuidVal.endsWith('.jsonl') ? uuidVal : `${uuidVal}.jsonl`;
          }
        }
      }
      if (!uuidFileName && !resolvedSrcPath) {
        sendJson(res, 404, { success: false, error: `Cannot resolve file for session: ${sessionKey}` });
        return true;
      }
      if (!resolvedSrcPath) {
        if (!uuidFileName!.endsWith('.jsonl')) uuidFileName = `${uuidFileName}.jsonl`;
        resolvedSrcPath = join(sessionsDir, uuidFileName!);
      }
      const dstPath = resolvedSrcPath.replace(/\.jsonl$/, '.deleted.jsonl');
      try {
        await fsP.access(resolvedSrcPath);
        await fsP.rename(resolvedSrcPath, dstPath);
      } catch {
        // Non-fatal; still try to update sessions.json.
      }
      const raw2 = await fsP.readFile(sessionsJsonPath, 'utf8');
      const json2 = JSON.parse(raw2) as Record<string, unknown>;
      if (Array.isArray(json2.sessions)) {
        json2.sessions = (json2.sessions as Array<Record<string, unknown>>)
          .filter((s) => s.key !== sessionKey && s.sessionKey !== sessionKey);
      } else if (json2[sessionKey]) {
        delete json2[sessionKey];
      }
      await fsP.writeFile(sessionsJsonPath, JSON.stringify(json2, null, 2), 'utf8');
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname === '/api/sessions/compress' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ sessionKey: string; keepCount?: number }>(req);
      const { sessionKey, keepCount = 10 } = body;
      
      if (!sessionKey || !sessionKey.startsWith('agent:')) {
        sendJson(res, 400, { success: false, error: `Invalid sessionKey: ${sessionKey}` });
        return true;
      }
      
      const parts = sessionKey.split(':');
      if (parts.length < 3) {
        sendJson(res, 400, { success: false, error: `sessionKey has too few parts: ${sessionKey}` });
        return true;
      }
      
      const agentId = parts[1];
      const sessionsDir = join(getOpenClawConfigDir(), 'agents', agentId, 'sessions');
      const sessionsJsonPath = join(sessionsDir, 'sessions.json');
      const fsP = await import('node:fs/promises');
      
      // 读取 sessions.json 获取会话文件路径
      const raw = await fsP.readFile(sessionsJsonPath, 'utf8');
      const sessionsJson = JSON.parse(raw) as Record<string, unknown>;
      
      let uuidFileName: string | undefined;
      if (Array.isArray(sessionsJson.sessions)) {
        const entry = (sessionsJson.sessions as Array<Record<string, unknown>>)
          .find((s) => s.key === sessionKey || s.sessionKey === sessionKey);
        if (entry) {
          uuidFileName = (entry.file ?? entry.fileName ?? entry.path) as string | undefined;
          if (!uuidFileName && typeof entry.id === 'string') {
            uuidFileName = `${entry.id}.jsonl`;
          }
        }
      }
      
      if (!uuidFileName && sessionsJson[sessionKey] != null) {
        const val = sessionsJson[sessionKey];
        if (typeof val === 'string') {
          uuidFileName = val;
        } else if (typeof val === 'object' && val !== null) {
          const entry = val as Record<string, unknown>;
          const absFile = (entry.sessionFile ?? entry.file ?? entry.fileName ?? entry.path) as string | undefined;
          if (absFile) {
            uuidFileName = absFile.startsWith('/') || absFile.match(/^[A-Za-z]:\\/) ? absFile : absFile;
          }
        }
      }
      
      if (!uuidFileName) {
        sendJson(res, 404, { success: false, error: `Cannot resolve file for session: ${sessionKey}` });
        return true;
      }
      
      const transcriptPath = uuidFileName.startsWith('/') 
        ? uuidFileName 
        : join(sessionsDir, uuidFileName.endsWith('.jsonl') ? uuidFileName : `${uuidFileName}.jsonl`);
      
      // 读取原始 transcript
      const rawTranscript = await fsP.readFile(transcriptPath, 'utf8');
      const lines = rawTranscript.split(/\r?\n/).filter(Boolean);
      
      // 解析消息
      const messages = lines.flatMap((line) => {
        try {
          const entry = JSON.parse(line);
          return entry.type === 'message' && entry.message ? [entry.message] : [];
        } catch {
          return [];
        }
      });
      
      // 如果消息数少于等于 keepCount，不需要压缩
      if (messages.length <= keepCount) {
        sendJson(res, 200, { 
          success: true, 
          compressed: false, 
          message: `Session has ${messages.length} messages, no compression needed`,
          messagesCount: messages.length 
        });
        return true;
      }
      
      // 保留最后 keepCount 条消息
      const truncatedMessages = messages.slice(-keepCount);
      
      // 创建压缩后的文件
      const compressedPath = transcriptPath.replace('.jsonl', '.compressed.jsonl');
      const summaryPath = transcriptPath.replace('.jsonl', '.summary.txt');
      
      // 生成摘要：保留被移除的消息的信息
      const removedCount = messages.length - keepCount;
      const summary = `=== Session Compressed ===\nPrevious messages: ${messages.length}\nKept: ${keepCount}\nRemoved: ${removedCount}\nCompressed at: ${new Date().toISOString()}\n\n=== First message summary ===\n${JSON.stringify(messages[0], null, 2).slice(0, 500)}...`;
      
      // 写入压缩后的文件（保留所有原始条目但标记为压缩）
      const compressedLines = lines.map((line) => {
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'message' && entry.message) {
            const msgIndex = messages.indexOf(entry.message);
            if (msgIndex >= 0 && msgIndex < messages.length - keepCount) {
              // 标记为已压缩
              return JSON.stringify({ ...entry, _compressed: true, _originalIndex: msgIndex });
            }
          }
          return line;
        } catch {
          return line;
        }
      });
      
      await fsP.writeFile(compressedPath, compressedLines.join('\n'), 'utf8');
      await fsP.writeFile(summaryPath, summary, 'utf8');
      
      // 更新 sessions.json 指向新文件
      let sessionUpdated = false;
      const updateSession = (entry: Record<string, unknown>) => {
        if (!sessionUpdated && (entry.key === sessionKey || entry.sessionKey === sessionKey)) {
          sessionUpdated = true;
          return { ...entry, file: compressedPath, compressed: true, compressedAt: Date.now() };
        }
        return entry;
      };
      
      if (Array.isArray(sessionsJson.sessions)) {
        sessionsJson.sessions = (sessionsJson.sessions as Array<Record<string, unknown>>)
          .map((s) => typeof s === 'object' ? updateSession(s as Record<string, unknown>) : s);
      }
      
      await fsP.writeFile(sessionsJsonPath, JSON.stringify(sessionsJson, null, 2), 'utf8');
      
      sendJson(res, 200, { 
        success: true, 
        compressed: true,
        previousCount: messages.length,
        keptCount: keepCount,
        removedCount,
        compressedFile: compressedPath
      });
    } catch (error) {
      console.error('[sessions] Compress error:', error);
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
