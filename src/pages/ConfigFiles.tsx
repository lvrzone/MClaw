/**
 * Config Files Page - 查看和编辑配置文件
 */
import { useState, useEffect, useCallback } from 'react';
import {
  FileJson,
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Edit3,
  Save,
  X,
  RefreshCw,
  Plus,
  Bot,
  User,
  Heart,
  Info,
  Wrench,
  Home,
  BookOpen,
  Copy,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useAgentsStore } from '@/stores/agents';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';

// 配置文件类型
interface ConfigFile {
  name: string;
  path: string;
  type: 'json' | 'markdown';
  category: 'system' | 'agent' | 'workspace';
  agentId?: string;
  agentName?: string;
  content: string;
  modified?: boolean;
}

// Agent bootstrap 文件类型
const AGENT_BOOTSTRAP_FILES = [
  { name: 'SOUL.md', label: '灵魂配置', icon: Heart, description: 'Agent 的核心性格和价值观' },
  { name: 'USER.md', label: '用户配置', icon: User, description: '用户信息和使用偏好' },
  { name: 'IDENTITY.md', label: '身份配置', icon: Info, description: 'Agent 身份标识' },
  { name: 'AGENTS.md', label: 'Agents 配置', icon: Bot, description: '多 Agent 协作配置' },
  { name: 'TOOLS.md', label: '工具配置', icon: Wrench, description: '可用工具列表' },
  { name: 'HEARTBEAT.md', label: '心跳配置', icon: Heart, description: '定时任务配置' },
  { name: 'BOOT.md', label: '启动配置', icon: Home, description: '启动时执行的配置' },
];

export function ConfigFiles() {
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['system', 'agents']));
  const [selectedFile, setSelectedFile] = useState<ConfigFile | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agentsStore = useAgentsStore();

  // 获取配置文件列表
  const fetchConfigFiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 从 API 获取配置文件列表
      const files: ConfigFile[] = [];

      // 1. 系统配置文件
      const openclawConfig = await hostApiFetch<{ content: string }>('/api/config/openclaw').catch(() => null);
      if (openclawConfig?.content) {
        try {
          const parsed = JSON.parse(openclawConfig.content);
          files.push({
            name: 'openclaw.json',
            path: '~/.openclaw/openclaw.json',
            type: 'json',
            category: 'system',
            content: JSON.stringify(parsed, null, 2),
          });
        } catch {
          files.push({
            name: 'openclaw.json',
            path: '~/.openclaw/openclaw.json',
            type: 'json',
            category: 'system',
            content: openclawConfig.content,
          });
        }
      }

      // 2. Agent 配置文件
      const agents = agentsStore.agents ?? [];
      for (const agent of agents) {
        const agentId = agent.id;
        const agentName = agent.name || agentId;

        // 获取每个 bootstrap 文件
        for (const fileInfo of AGENT_BOOTSTRAP_FILES) {
          try {
            const response = await hostApiFetch<{ content?: string; error?: string }>(
              `/api/config/agent/${agentId}/file/${fileInfo.name}`
            );

            if (response?.content !== undefined) {
              files.push({
                name: fileInfo.name,
                path: `~/.openclaw/workspace-${agentId}/${fileInfo.name}`,
                type: 'markdown',
                category: 'agent',
                agentId,
                agentName,
                content: response.content,
              });
            }
          } catch {
            // 文件不存在或无法读取
          }
        }
      }

      return files;
    } catch (err) {
      console.error('Failed to fetch config files:', err);
      setError('无法加载配置文件');
      return [];
    } finally {
      setLoading(false);
    }
  }, [agentsStore.agents]);

  const [configFiles, setConfigFiles] = useState<ConfigFile[]>([]);

  useEffect(() => {
    const loadFiles = async () => {
      const files = await fetchConfigFiles();
      setConfigFiles(files);
    };
    loadFiles();
  }, [fetchConfigFiles]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const openFile = (file: ConfigFile) => {
    setSelectedFile({ ...file, modified: false });
    setEditContent(file.content);
    setSaveSuccess(false);
  };

  const handleContentChange = (content: string) => {
    setEditContent(content);
    if (selectedFile) {
      setSelectedFile({ ...selectedFile, modified: content !== selectedFile.content });
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;

    setSaving(true);
    setError(null);

    try {
      if (selectedFile.type === 'json') {
        // 验证 JSON 格式
        JSON.parse(editContent);
      }

      // 通过 API 保存文件
      await hostApiFetch('/api/config/agent/' + selectedFile.agentId + '/file/' + selectedFile.name, {
        method: 'POST',
        body: JSON.stringify({ content: editContent }),
      });

      setSaveSuccess(true);
      setSelectedFile({ ...selectedFile, content: editContent, modified: false });

      // 2秒后清除成功提示
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const closeFile = () => {
    if (selectedFile?.modified) {
      if (!confirm('文件有未保存的更改，确定要关闭吗？')) {
        return;
      }
    }
    setSelectedFile(null);
    setEditContent('');
    setSaveSuccess(false);
  };

  // 按分类分组
  const groupedFiles = configFiles.reduce((acc, file) => {
    const key = file.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {} as Record<string, ConfigFile[]>);

  // 单独收集 agent 文件
  const systemFiles = groupedFiles['system'] || [];
  const agentFiles = groupedFiles['agent'] || [];
  const agentsGrouped = agentFiles.reduce((acc, file) => {
    const agentId = file.agentId || 'unknown';
    if (!acc[agentId]) acc[agentId] = { name: file.agentName || agentId, files: [] };
    acc[agentId].files.push(file);
    return acc;
  }, {} as Record<string, { name: string; files: ConfigFile[] }>);

  return (
    <div className="h-full flex overflow-hidden" style={{ background: 'var(--theme-bg-root)' }}>
      {/* 左侧文件列表 */}
      <div
        className="w-[280px] shrink-0 flex flex-col border-r overflow-hidden"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-orange-500" />
              <h2 className="text-[14px] font-semibold" style={{ color: 'var(--theme-text-primary)' }}>配置文件</h2>
            </div>
            <button
              onClick={fetchConfigFiles}
              disabled={loading}
              className="p-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{ color: 'var(--theme-text-muted)' }}
              title="刷新"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* 系统配置 */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
            <button
              onClick={() => toggleSection('system')}
              className="w-full flex items-center justify-between px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-orange-500" />
                <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>系统配置</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--theme-text-muted)' }}>
                {systemFiles.length}
              </span>
            </button>
            {expandedSections.has('system') && (
              <div className="divide-y" style={{ borderTop: '1px solid var(--theme-border)' }}>
                {systemFiles.map(file => (
                  <FileItem key={file.path} file={file} selected={selectedFile?.path === file.path} onClick={() => openFile(file)} />
                ))}
              </div>
            )}
          </div>

          {/* Agent 配置 */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
            <button
              onClick={() => toggleSection('agents')}
              className="w-full flex items-center justify-between px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-500" />
                <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>Agent 配置</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--theme-text-muted)' }}>
                {agentFiles.length}
              </span>
            </button>
            {expandedSections.has('agents') && (
              <div className="divide-y" style={{ borderTop: '1px solid var(--theme-border)' }}>
                {Object.entries(agentsGrouped).map(([agentId, { name, files }]) => (
                  <div key={agentId}>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(0,0,0,0.02)]">
                      <Bot className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-[11px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>{name}</span>
                    </div>
                    {files.map(file => (
                      <FileItem key={file.path} file={file} selected={selectedFile?.path === file.path} onClick={() => openFile(file)} indent />
                    ))}
                  </div>
                ))}
                {Object.keys(agentsGrouped).length === 0 && (
                  <div className="px-3 py-4 text-center">
                    <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>暂无 Agent 配置</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧编辑器 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <>
            {/* 编辑器头部 */}
            <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}>
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-blue-500" />
                <div>
                  <h3 className="text-[13px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                    {selectedFile.name}
                  </h3>
                  <p className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                    {selectedFile.path}
                    {selectedFile.agentName && ` · ${selectedFile.agentName}`}
                  </p>
                </div>
                {selectedFile.modified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    已修改
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {saveSuccess && (
                  <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    已保存
                  </span>
                )}
                {error && (
                  <span className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {error}
                  </span>
                )}
                <button
                  onClick={closeFile}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 编辑器内容 */}
            <div className="flex-1 overflow-hidden p-4">
              <textarea
                value={editContent}
                onChange={(e) => handleContentChange(e.target.value)}
                className="w-full h-full p-3 rounded-lg resize-none outline-none font-mono text-[12px] leading-relaxed"
                style={{
                  background: 'var(--theme-sidebar-bg)',
                  color: 'var(--theme-text-primary)',
                  border: '1px solid var(--theme-border)',
                }}
                spellCheck={false}
              />
            </div>

            {/* 编辑器底部 */}
            <div className="px-4 py-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                <span>行数: {editContent.split('\n').length}</span>
                <span>·</span>
                <span>字符: {editContent.length}</span>
                {selectedFile.type === 'json' && (
                  <>
                    <span>·</span>
                    <span className={cn(
                      selectedFile.content !== editContent ? 'text-yellow-500' : 'text-green-500'
                    )}>
                      JSON {selectedFile.content !== editContent ? '已修改' : '有效'}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditContent(selectedFile.content)}
                  disabled={!selectedFile.modified}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--theme-text-secondary)' }}
                >
                  重置
                </button>
                <button
                  onClick={saveFile}
                  disabled={saving || !selectedFile.modified}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all disabled:opacity-50"
                  style={{ background: 'rgba(10,132,255,0.15)', color: 'var(--theme-accent-blue)' }}
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* 空状态 */
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <FileText className="h-16 w-16" style={{ color: 'var(--theme-text-muted)', opacity: 0.3 }} />
            <div className="text-center">
              <p className="text-[14px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>
                选择要编辑的配置文件
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                点击左侧文件列表中的配置文件进行编辑
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 文件项组件 ──────────────────────────────────────────────
function FileItem({
  file,
  selected,
  onClick,
  indent = false,
}: {
  file: ConfigFile;
  selected: boolean;
  onClick: () => void;
  indent?: boolean;
}) {
  const getFileIcon = () => {
    if (file.type === 'json') return <FileJson className="h-3.5 w-3.5 text-orange-400" />;
    const bootstrapFile = AGENT_BOOTSTRAP_FILES.find(f => f.name === file.name);
    if (bootstrapFile) {
      const Icon = bootstrapFile.icon;
      return <Icon className="h-3.5 w-3.5 text-blue-400" />;
    }
    return <FileText className="h-3.5 w-3.5 text-gray-400" />;
  };

  const getFileLabel = () => {
    const bootstrapFile = AGENT_BOOTSTRAP_FILES.find(f => f.name === file.name);
    return bootstrapFile?.label || file.name;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all',
        indent && 'pl-8',
        selected
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-[var(--theme-session-hover)]'
      )}
    >
      {getFileIcon()}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-[11px] truncate',
          selected ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-[var(--theme-text-primary)]'
        )}>
          {getFileLabel()}
        </p>
        {file.agentName && (
          <p className="text-[9px]" style={{ color: 'var(--theme-text-muted)' }}>
            {file.agentName}
          </p>
        )}
      </div>
    </button>
  );
}
