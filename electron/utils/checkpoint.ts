/**
 * Checkpoint Service
 * File backup and rollback functionality for MClaw
 * Inspired by CodeBuddy's checkpoint system
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';
import crypto from 'node:crypto';

const CHECKPOINT_DIR = join(homedir(), '.mclaw', 'checkpoints');
const MAX_CHECKPOINTS = 10;

export interface Checkpoint {
  id: string;
  taskId: string;
  timestamp: number;
  comment: string;
  fileCount: number;
  files: string[];
}

export interface CheckpointInfo {
  id: string;
  checkpointId: string;
  taskId: string;
  timestamp: number;
  time: string;
  comment: string;
  fileCount: number;
}

/**
 * Ensure checkpoint directory exists
 */
function ensureCheckpointDir(): void {
  if (!existsSync(CHECKPOINT_DIR)) {
    mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }
}

/**
 * Get checkpoint path for a checkpoint ID
 */
function getCheckpointPath(checkpointId: string): string {
  return join(CHECKPOINT_DIR, checkpointId);
}

/**
 * Get metadata file path for a checkpoint
 */
function getMetadataPath(checkpointId: string): string {
  return join(getCheckpointPath(checkpointId), 'checkpoint.json');
}

/**
 * List all files in a directory recursively
 */
function listFilesRecursive(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  
  if (!existsSync(dir)) return files;
  
  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.slice(baseDir.length + 1);
    
    // Skip checkpoint directory itself and hidden files
    if (relativePath.startsWith('.mclaw') || relativePath.startsWith('node_modules') || relativePath.startsWith('.git')) {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, baseDir));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
}

/**
 * Copy file preserving directory structure
 */
function copyFileWithDir(src: string, dest: string): void {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  copyFileSync(src, dest);
}

/**
 * Create a checkpoint for the current project
 */
export function createCheckpoint(taskId: string, comment: string = '自动创建', projectDir: string = process.cwd()): Checkpoint {
  ensureCheckpointDir();
  
  const timestamp = Date.now();
  const checkpointId = `${taskId}_${timestamp}`;
  const checkpointPath = getCheckpointPath(checkpointId);
  
  // Create checkpoint directory
  mkdirSync(checkpointPath, { recursive: true });
  
  // List all files in project
  const files = listFilesRecursive(projectDir);
  
  // Copy each file to checkpoint
  for (const filePath of files) {
    const srcPath = join(projectDir, filePath);
    const destPath = join(checkpointPath, filePath);
    try {
      copyFileWithDir(srcPath, destPath);
    } catch (err) {
      console.warn(`Failed to copy file ${filePath}:`, err);
    }
  }
  
  // Save metadata
  const metadata = {
    id: checkpointId,
    taskId,
    timestamp,
    comment,
    fileCount: files.length,
    files,
  };
  
  writeFileSync(
    getMetadataPath(checkpointId),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );
  
  // Clean old checkpoints
  cleanOldCheckpoints(taskId);
  
  return metadata;
}

/**
 * Get all checkpoints for a task
 */
export function getCheckpoints(taskId: string): CheckpointInfo[] {
  ensureCheckpointDir();
  
  const checkpoints: CheckpointInfo[] = [];
  
  if (!existsSync(CHECKPOINT_DIR)) return checkpoints;
  
  const entries = readdirSync(CHECKPOINT_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const [tid, timestampStr] = entry.name.split('_');
    if (tid !== taskId) continue;
    
    const metadataPath = getMetadataPath(entry.name);
    if (!existsSync(metadataPath)) continue;
    
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as Checkpoint;
      checkpoints.push({
        id: metadata.id,
        checkpointId: entry.name,
        taskId: metadata.taskId,
        timestamp: metadata.timestamp,
        time: new Date(metadata.timestamp).toLocaleString('zh-CN'),
        comment: metadata.comment,
        fileCount: metadata.fileCount,
      });
    } catch {
      // Skip invalid checkpoints
    }
  }
  
  // Sort by timestamp descending
  return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get a single checkpoint by ID
 */
export function getCheckpoint(checkpointId: string): Checkpoint | null {
  const metadataPath = getMetadataPath(checkpointId);
  if (!existsSync(metadataPath)) return null;
  
  try {
    return JSON.parse(readFileSync(metadataPath, 'utf-8')) as Checkpoint;
  } catch {
    return null;
  }
}

/**
 * Rollback to a checkpoint
 */
export function rollbackCheckpoint(checkpointId: string, projectDir: string = process.cwd()): { success: boolean; message: string } {
  const checkpoint = getCheckpoint(checkpointId);
  if (!checkpoint) {
    return { success: false, message: 'Checkpoint不存在' };
  }
  
  const checkpointPath = getCheckpointPath(checkpointId);
  
  // Restore each file
  let restoredCount = 0;
  for (const filePath of checkpoint.files) {
    const srcPath = join(checkpointPath, filePath);
    const destPath = join(projectDir, filePath);
    
    if (!existsSync(srcPath)) continue;
    
    try {
      copyFileWithDir(srcPath, destPath);
      restoredCount++;
    } catch (err) {
      console.warn(`Failed to restore file ${filePath}:`, err);
    }
  }
  
  return { 
    success: true, 
    message: `已回滚到Checkpoint ${checkpointId}，恢复了 ${restoredCount} 个文件` 
  };
}

/**
 * Delete a checkpoint
 */
export function deleteCheckpoint(checkpointId: string): boolean {
  const checkpointPath = getCheckpointPath(checkpointId);
  if (!existsSync(checkpointPath)) return false;
  
  try {
    rmSync(checkpointPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean old checkpoints, keeping only the most recent MAX_CHECKPOINTS
 */
function cleanOldCheckpoints(taskId: string): void {
  const checkpoints = getCheckpoints(taskId);
  
  if (checkpoints.length <= MAX_CHECKPOINTS) return;
  
  const oldCheckpoints = checkpoints.slice(MAX_CHECKPOINTS);
  
  for (const checkpoint of oldCheckpoints) {
    deleteCheckpoint(checkpoint.checkpointId);
  }
}

/**
 * Get checkpoint storage stats
 */
export function getCheckpointStats(): { totalCheckpoints: number; totalSize: number } {
  ensureCheckpointDir();
  
  let totalCheckpoints = 0;
  let totalSize = 0;
  
  const entries = readdirSync(CHECKPOINT_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    totalCheckpoints++;
    
    const checkpointPath = join(CHECKPOINT_DIR, entry.name);
    try {
      const files = listFilesRecursive(checkpointPath);
      for (const file of files) {
        const filePath = join(checkpointPath, file);
        try {
          const stats = statSync(filePath);
          totalSize += stats.size;
        } catch {
          // Skip files we can't stat
        }
      }
    } catch {
      // Skip checkpoints we can't read
    }
  }
  
  return { totalCheckpoints, totalSize };
}
