/**
 * Logs Page - 查看所有应用数据、状态和日志
 */
import { useState, useEffect, useCallback } from 'react';
import {
  FileJson,
  Database,
  MessageSquare,
  Bot,
  Settings,
  Zap,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  Terminal,
  FileText,
  Eye,
  FolderOpen,
} from 'lucide-react';
import { useChatStore } from '@/stores/chat';
import { useSettingsStore } from '@/stores/settings';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { useProviderStore } from '@/stores/providers';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';

type LogLevel = 'all' | 'info' | 'success' | 'warning' | 'error';
type TabType = 'app' | 'gateway';

interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modified: string;
}

export function Logs() {
  const [activeTab, setActiveTab] = useState<TabType>('app');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['chat', 'gateway', 'settings']));
  const [filterLevel, setFilterLevel] = useState<LogLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Gateway 日志相关
  const [gatewayLogs, setGatewayLogs] = useState<string[]>([]);
  const [gatewayFiles, setGatewayFiles] = useState<LogFileInfo[]>([]);
  const [selectedGatewayFile, setSelectedGatewayFile] = useState<string>('');
  const [gatewayLoading, setGatewayLoading] = useState(false);

  // 引用各 store
  const chatStore = useChatStore();
  const settingsStore = useSettingsStore();
  const gatewayStore = useGatewayStore();
  const agentsStore = useAgentsStore();
  const providersStore = useProviderStore();

  // 读取 Gateway 日志文件
  const fetchGatewayLogs = useCallback(async () => {
    setGatewayLoading(true);
    try {
      // 从 Gateway API 读取日志
      const [logsRes, filesRes] = await Promise.all([
        hostApiFetch<{ content: string }>('/api/logs/tail?lines=200'),
        hostApiFetch<{ files: LogFileInfo[] }>('/api/logs/files'),
      ]);

      if (logsRes.content) {
        // 解析 JSONL 格式的日志
        const lines = logsRes.content.trim().split('\n');
        setGatewayLogs(lines.filter(Boolean));
      }

      if (filesRes.files) {
        setGatewayFiles(filesRes.files);
        if (!selectedGatewayFile && filesRes.files.length > 0) {
          setSelectedGatewayFile(filesRes.files[0].path);
        }
      }
    } catch (error) {
      console.error('Failed to fetch gateway logs:', error);
    } finally {
      setGatewayLoading(false);
    }
  }, [selectedGatewayFile]);

  // 读取指定 Gateway 日志文件
  const fetchGatewayFileContent = useCallback(async (filePath: string) => {
    setGatewayLoading(true);
    try {
      // 通过 IPC 读取文件
      const content = await window.electron.ipcRenderer.invoke('log:readFile', 500);
      if (content) {
        const lines = content.trim().split('\n');
        setGatewayLogs(lines.filter(Boolean));
      }
    } catch (error) {
      console.error('Failed to fetch gateway file:', error);
    } finally {
      setGatewayLoading(false);
    }
  }, []);

  // 初始化和刷新
  useEffect(() => {
    if (activeTab === 'gateway') {
      fetchGatewayLogs();
    }
  }, [activeTab, fetchGatewayLogs]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || activeTab !== 'gateway') return;
    const interval = setInterval(fetchGatewayLogs, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, fetchGatewayLogs]);

  // 解析 Gateway 日志行
  const parseGatewayLogLine = (line: string): { timestamp: string; level: string; message: string; data?: unknown } | null => {
    try {
      const parsed = JSON.parse(line);
      return {
        timestamp: parsed.timestamp || parsed.time || '',
        level: parsed.level || parsed.severity || 'info',
        message: parsed.message || parsed.msg || line,
        data: parsed.data || parsed,
      };
    } catch {
      // 非 JSON 格式，直接返回原始文本
      const timeMatch = line.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
      return {
        timestamp: timeMatch ? timeMatch[1] : '',
        level: line.includes('ERROR') ? 'error' : line.includes('WARN') ? 'warning' : 'info',
        message: line,
      };
    }
  };

  const getLogLevelStyle = (level: string) => {
    const l = level.toLowerCase();
    if (l === 'error' || l === 'err' || l === 'fatal') return { bg: 'bg-red-50 dark:bg-red-950/30', icon: XCircle, color: 'text-red-500' };
    if (l === 'warning' || l === 'warn') return { bg: 'bg-yellow-50 dark:bg-yellow-950/30', icon: AlertCircle, color: 'text-yellow-500' };
    if (l === 'info') return { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: Info, color: 'text-blue-500' };
    return { bg: 'bg-gray-50 dark:bg-gray-800/30', icon: Terminal, color: 'text-gray-500' };
  };

  // 复制全部数据
  const copyAllData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      chat: {
        sessions: chatStore.sessions,
        messages: chatStore.messages,
        currentSessionKey: chatStore.currentSessionKey,
        currentAgentId: chatStore.currentAgentId,
      },
      gateway: gatewayStore.status,
      settings: {
        theme: settingsStore.theme,
        language: settingsStore.language,
        setupComplete: settingsStore.setupComplete,
      },
      agents: agentsStore.agents,
      providers: providersStore.providers,
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  // 下载全部数据
  const downloadAllData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      chat: {
        sessions: chatStore.sessions,
        messages: chatStore.messages,
        currentSessionKey: chatStore.currentSessionKey,
        currentAgentId: chatStore.currentAgentId,
      },
      gateway: gatewayStore.status,
      settings: {
        theme: settingsStore.theme,
        language: settingsStore.language,
        setupComplete: settingsStore.setupComplete,
      },
      agents: agentsStore.agents,
      providers: providersStore.providers,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lclaw-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (category: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--theme-bg-root)' }}>
      {/* 头部 */}
      <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5" style={{ color: 'var(--theme-accent-blue)' }} />
              <h1 className="text-[16px] font-semibold" style={{ color: 'var(--theme-text-primary)' }}>日志与数据</h1>
            </div>
            {/* Tabs */}
            <div className="flex items-center gap-1 ml-4">
              <button
                onClick={() => setActiveTab('app')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                  activeTab === 'app'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-session-hover)]'
                )}
              >
                应用状态
              </button>
              <button
                onClick={() => setActiveTab('gateway')}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
                  activeTab === 'gateway'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'text-[var(--theme-text-secondary)] hover:bg-[var(--theme-session-hover)]'
                )}
              >
                Gateway 日志
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                autoRefresh
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', autoRefresh && 'animate-spin')} />
              {autoRefresh ? '实时' : '已暂停'}
            </button>
            {activeTab === 'app' && (
              <>
                <button
                  onClick={copyAllData}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--theme-text-secondary)' }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  复制
                </button>
                <button
                  onClick={downloadAllData}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{ background: 'rgba(10,132,255,0.15)', color: 'var(--theme-accent-blue)' }}
                >
                  <Download className="h-3.5 w-3.5" />
                  导出
                </button>
              </>
            )}
          </div>
        </div>

        {/* 搜索和过滤 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--theme-text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索..."
              className="w-full pl-8 pr-3 py-1.5 text-[12px] rounded-lg outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--theme-text-primary)',
                border: '1px solid transparent',
              }}
            />
          </div>
          {activeTab === 'app' && (
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as LogLevel)}
              className="px-2 py-1.5 text-[11px] rounded-lg outline-none cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--theme-text-secondary)',
                border: '1px solid var(--theme-border)',
              }}
            >
              <option value="all">全部级别</option>
              <option value="info">信息</option>
              <option value="success">成功</option>
              <option value="warning">警告</option>
              <option value="error">错误</option>
            </select>
          )}
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'app' ? (
          /* ===== 应用状态视图 ===== */
          <AppStatusView
            chatStore={chatStore}
            settingsStore={settingsStore}
            gatewayStore={gatewayStore}
            agentsStore={agentsStore}
            providersStore={providersStore}
            expandedSections={expandedSections}
            filterLevel={filterLevel}
            searchQuery={searchQuery}
            onToggleSection={toggleSection}
          />
        ) : (
          /* ===== Gateway 日志视图 ===== */
          <GatewayLogsView
            logs={gatewayLogs}
            files={gatewayFiles}
            selectedFile={selectedGatewayFile}
            onSelectFile={setSelectedGatewayFile}
            loading={gatewayLoading}
            searchQuery={searchQuery}
            onRefresh={fetchGatewayLogs}
            parseLogLine={parseGatewayLogLine}
            getLogLevelStyle={getLogLevelStyle}
          />
        )}
      </div>
    </div>
  );
}

// ── 应用状态视图 ──────────────────────────────────────────────
interface AppStatusViewProps {
  chatStore: ReturnType<typeof useChatStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
  gatewayStore: ReturnType<typeof useGatewayStore>;
  agentsStore: ReturnType<typeof useAgentsStore>;
  providersStore: ReturnType<typeof useProviderStore>;
  expandedSections: Set<string>;
  filterLevel: LogLevel;
  searchQuery: string;
  onToggleSection: (category: string) => void;
}

function AppStatusView({
  chatStore,
  settingsStore,
  gatewayStore,
  agentsStore,
  providersStore,
  expandedSections,
  filterLevel,
  searchQuery,
  onToggleSection,
}: AppStatusViewProps) {
  const CATEGORY_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    chat: { label: '对话', icon: MessageSquare },
    gateway: { label: '网关', icon: Zap },
    settings: { label: '设置', icon: Settings },
    agents: { label: 'Agents', icon: Bot },
    providers: { label: '供应商', icon: Database },
    system: { label: '系统', icon: Terminal },
  };

  const CATEGORY_COLORS: Record<string, string> = {
    chat: 'text-blue-500',
    gateway: 'text-green-500',
    settings: 'text-orange-500',
    agents: 'text-purple-500',
    providers: 'text-cyan-500',
    system: 'text-gray-500',
  };

  // 生成状态数据
  const generateStatusData = () => {
    const data: Array<{
      id: string;
      category: string;
      title: string;
      content?: string;
      level: 'info' | 'success' | 'warning' | 'error';
      data: unknown;
    }> = [];

    // Chat Store
    data.push({
      id: 'chat-1',
      category: 'chat',
      title: '会话数量',
      content: `${chatStore.sessions.length} 个会话`,
      level: 'info',
      data: { sessionCount: chatStore.sessions.length },
    });

    if (chatStore.messages.length > 0) {
      data.push({
        id: 'chat-2',
        category: 'chat',
        title: '当前消息数',
        content: `${chatStore.messages.length} 条消息`,
        level: 'info',
        data: { messageCount: chatStore.messages.length },
      });
    }

    if (chatStore.currentAgentId) {
      data.push({
        id: 'chat-3',
        category: 'chat',
        title: '当前 Agent',
        content: chatStore.currentAgentId,
        level: 'success',
        data: { currentAgentId: chatStore.currentAgentId },
      });
    }

    // Gateway
    const gwState = gatewayStore.status.state;
    data.push({
      id: 'gateway-1',
      category: 'gateway',
      title: 'Gateway 状态',
      content: gwState,
      level: gwState === 'running' ? 'success' : gwState === 'error' ? 'error' : 'warning',
      data: gatewayStore.status,
    });

    // Settings
    data.push({
      id: 'settings-1',
      category: 'settings',
      title: '主题设置',
      content: settingsStore.theme,
      level: 'info',
      data: { theme: settingsStore.theme },
    });

    // Agents
    const agents = agentsStore.agents ?? [];
    data.push({
      id: 'agents-1',
      category: 'agents',
      title: 'Agent 数量',
      content: `${agents.length} 个 Agent`,
      level: 'info',
      data: { agents: agents.map(a => ({ id: a.id, name: a.name })) },
    });

    // Providers
    const providers = providersStore.providers ?? [];
    const enabledCount = providers.filter(p => p.enabled).length;
    data.push({
      id: 'providers-1',
      category: 'providers',
      title: '已启用的 Provider',
      content: `${enabledCount} / ${providers.length}`,
      level: enabledCount > 0 ? 'success' : 'warning',
      data: { providers: providers.map(p => ({ id: p.id, name: p.name, enabled: p.enabled })) },
    });

    // System
    data.push({
      id: 'system-1',
      category: 'system',
      title: '浏览器信息',
      content: navigator.userAgent.split(' ').pop(),
      level: 'info',
      data: { userAgent: navigator.userAgent },
    });

    return data;
  };

  const allData = generateStatusData();

  // 过滤数据
  const filteredData = allData.filter(item => {
    if (filterLevel !== 'all' && item.level !== filterLevel) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query) ||
        JSON.stringify(item.data).toLowerCase().includes(query)
      );
    }
    return true;
  });

  // 按分类分组
  const groupedData = filteredData.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof filteredData>);

  const LOG_COLORS = {
    info: { bg: 'bg-blue-50 dark:bg-blue-950/30', icon: Info, iconColor: 'text-blue-500' },
    success: { bg: 'bg-green-50 dark:bg-green-950/30', icon: CheckCircle, iconColor: 'text-green-500' },
    warning: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', icon: AlertCircle, iconColor: 'text-yellow-500' },
    error: { bg: 'bg-red-50 dark:bg-red-950/30', icon: XCircle, iconColor: 'text-red-500' },
  };

  return (
    <div className="space-y-2">
      {Object.entries(groupedData).map(([category, items]) => {
        const { label, icon: Icon } = CATEGORY_LABELS[category] || { label: category, icon: Terminal };
        const isExpanded = expandedSections.has(category);
        const color = CATEGORY_COLORS[category] || 'text-gray-500';

        return (
          <div key={category} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
            <button
              onClick={() => onToggleSection(category)}
              className="w-full flex items-center justify-between px-3 py-2 transition-all"
              style={{ background: 'var(--theme-sidebar-bg)' }}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', color)} />
                <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                  {label}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--theme-text-muted)' }}
                >
                  {items.length}
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" style={{ color: 'var(--theme-text-muted)' }} />
              ) : (
                <ChevronRight className="h-4 w-4" style={{ color: 'var(--theme-text-muted)' }} />
              )}
            </button>

            {isExpanded && (
              <div className="divide-y" style={{ borderTop: '1px solid var(--theme-border)' }}>
                {items.map((item) => {
                  const colors = LOG_COLORS[item.level];
                  const LevelIcon = colors.icon;

                  return (
                    <div key={item.id} className={cn('px-3 py-2', colors.bg)}>
                      <div className="flex items-start gap-2">
                        <LevelIcon className={cn('h-4 w-4 mt-0.5 shrink-0', colors.iconColor)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                              {item.title}
                            </span>
                          </div>
                          {item.content && (
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--theme-text-secondary)' }}>
                              {item.content}
                            </p>
                          )}
                          {item.data && (
                            <details className="mt-1">
                              <summary className="text-[10px] cursor-pointer" style={{ color: 'var(--theme-text-muted)' }}>
                                查看数据
                              </summary>
                              <pre
                                className="mt-1 p-2 rounded-lg text-[10px] overflow-x-auto"
                                style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--theme-text-secondary)', maxHeight: 200 }}
                              >
                                {JSON.stringify(item.data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Gateway 日志视图 ──────────────────────────────────────────────
interface GatewayLogsViewProps {
  logs: string[];
  files: LogFileInfo[];
  selectedFile: string;
  onSelectFile: (path: string) => void;
  loading: boolean;
  searchQuery: string;
  onRefresh: () => void;
  parseLogLine: (line: string) => { timestamp: string; level: string; message: string; data?: unknown } | null;
  getLogLevelStyle: (level: string) => { bg: string; icon: React.ComponentType<{ className?: string }>; color: string };
}

function GatewayLogsView({
  logs,
  files,
  selectedFile,
  onSelectFile,
  loading,
  searchQuery,
  onRefresh,
  parseLogLine,
  getLogLevelStyle,
}: GatewayLogsViewProps) {
  const filteredLogs = searchQuery
    ? logs.filter(log => log.toLowerCase().includes(searchQuery.toLowerCase()))
    : logs;

  return (
    <div className="h-full flex flex-col gap-3">
      {/* 文件选择器 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--theme-sidebar-bg)' }}>
        <FolderOpen className="h-4 w-4 text-purple-500" />
        <span className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>选择文件：</span>
        <select
          value={selectedFile}
          onChange={(e) => onSelectFile(e.target.value)}
          className="flex-1 px-2 py-1 text-[11px] rounded-lg outline-none cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--theme-text-primary)',
            border: '1px solid var(--theme-border)',
          }}
        >
          {files.map(file => (
            <option key={file.path} value={file.path}>
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </option>
          ))}
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all disabled:opacity-50"
          style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          刷新
        </button>
      </div>

      {/* 日志列表 */}
      <div className="flex-1 overflow-y-auto rounded-lg" style={{ background: 'var(--theme-sidebar-bg)', border: '1px solid var(--theme-border)' }}>
        {filteredLogs.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Terminal className="h-10 w-10" style={{ color: 'var(--theme-text-muted)', opacity: 0.3 }} />
            <p className="text-[13px]" style={{ color: 'var(--theme-text-muted)' }}>
              {searchQuery ? '没有找到匹配的日志' : '暂无日志内容'}
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {filteredLogs.map((line, index) => {
              const parsed = parseLogLine(line);
              if (!parsed) return null;

              const levelStyle = getLogLevelStyle(parsed.level);
              const LevelIcon = levelStyle.icon;

              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-2 px-2 py-1 rounded text-[11px] font-mono',
                    levelStyle.bg
                  )}
                >
                  <LevelIcon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', levelStyle.color)} />
                  {parsed.timestamp && (
                    <span className="shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                      {parsed.timestamp.split('T')[1]?.split('.')[0] || parsed.timestamp}
                    </span>
                  )}
                  <span className="flex-1 break-all" style={{ color: 'var(--theme-text-primary)' }}>
                    {parsed.message}
                  </span>
                  {parsed.data && Object.keys(parsed.data).length > 2 && (
                    <details className="shrink-0">
                      <summary className="cursor-pointer opacity-50 hover:opacity-100">
                        <Eye className="h-3 w-3" />
                      </summary>
                      <pre
                        className="mt-1 p-1 rounded text-[9px] max-h-20 overflow-auto"
                        style={{ background: 'rgba(0,0,0,0.05)' }}
                      >
                        {JSON.stringify(parsed.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 统计信息 */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px]" style={{ background: 'rgba(139,92,246,0.08)' }}>
        <span style={{ color: 'var(--theme-text-muted)' }}>
          共 {filteredLogs.length} 条日志
          {searchQuery && ` (匹配 "${searchQuery}")`}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> 信息
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-500" /> 警告
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> 错误
          </span>
        </div>
      </div>
    </div>
  );
}
