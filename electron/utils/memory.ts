/**
 * Memory Service - 项目记忆管理
 * 存储在 .mclaw/memory.json
 */

import fs from 'fs/promises';
import path from 'path';
import { getMClawConfigDir } from './paths';

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

function getMemoryPath(projectDir?: string): string {
  if (projectDir) {
    return path.join(projectDir, '.mclaw', 'memory.json');
  }
  return path.join(getMClawConfigDir(), 'memory.json');
}

async function initMemory(projectDir?: string): Promise<void> {
  const memoryPath = getMemoryPath(projectDir);
  const dir = path.dirname(memoryPath);

  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }

  try {
    await fs.access(memoryPath);
  } catch {
    await fs.writeFile(memoryPath, JSON.stringify(DEFAULT_MEMORY, null, 2), 'utf-8');
  }
}

export async function getMemory(projectDir?: string): Promise<MemoryData> {
  await initMemory(projectDir);
  const memoryPath = getMemoryPath(projectDir);
  const content = await fs.readFile(memoryPath, 'utf-8');
  return JSON.parse(content) as MemoryData;
}

export async function updateMemory(
  updates: Partial<MemoryData>,
  projectDir?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    await initMemory(projectDir);
    const memory = await getMemory(projectDir);
    const newMemory = deepMerge(memory, updates);
    const memoryPath = getMemoryPath(projectDir);
    await fs.writeFile(memoryPath, JSON.stringify(newMemory, null, 2), 'utf-8');
    return { success: true, message: '记忆更新成功' };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function getMemoryPrompt(projectDir?: string): Promise<string> {
  try {
    const memory = await getMemory(projectDir);
    const parts: string[] = [];
    parts.push('记住用户的偏好和项目上下文：');
    parts.push(`1. 用户偏好：${JSON.stringify(memory.userPreferences, null, 2)}`);
    parts.push(`2. 项目上下文：${JSON.stringify(memory.projectContext, null, 2)}`);
    if (memory.projectContext.recentOperations.length > 0) {
      parts.push(`3. 近期操作：${memory.projectContext.recentOperations.slice(-5).join('; ')}`);
    }
    return parts.join('\n');
  } catch {
    return '';
  }
}

function deepMerge(target: any, source: any): any {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}
