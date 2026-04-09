/**
 * MClaw Sidebar - QClaw风格
 * 单列可展开树形列表：Agent + 展开显示会话
 * 极简布局，去掉多余的侧边栏分割
 */
import { useEffect, useMemo, useState, useRef, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Plus,
  Terminal,
  Trash2,
  Search,
  X,
  Bot,
  Network,
  Puzzle,
  Clock,
  Cpu,
  MessageSquare,
  ChevronRight,
  ChevronDown,
  Home,
  Users,
  Check,
  Pencil,
  PanelLeftClose,
  PanelLeft,
  MoreHorizontal,
  MessageCircle,
  Laptop,
  FileText,
  FolderCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';
import { useAgentsStore } from '@/stores/agents';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { hostApiFetch } from '@/lib/host-api';
import { useTranslation } from 'react-i18next';
import logoPng from '@/assets/猫爪logo.png';

// ── Types ──────────────────────────────────────────────────────
type SessionBucketKey = 'today' | 'yesterday' | 'withinWeek' | 'older';

type NavPage = 'chat' | 'models' | 'agents' | 'channels' | 'skills' | 'cron' | 'settings' | 'logs' | 'config';

// ── Helpers ────────────────────────────────────────────────────
function getSessionBucket(activityMs: number, nowMs: number): SessionBucketKey {
  if (!activityMs || activityMs <= 0) return 'older';
  const now = new Date(nowMs);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  if (activityMs >= startOfToday) return 'today';
  if (activityMs >= startOfYesterday) return 'yesterday';
  const daysAgo = (startOfToday - activityMs) / (24 * 60 * 60 * 1000);
  if (daysAgo <= 7) return 'withinWeek';
  return 'older';
}

const INITIAL_NOW_MS = Date.now();

function getAgentIdFromSessionKey(sessionKey: string): string {
  if (!sessionKey.startsWith('agent:')) return 'main';
  const [, agentId] = sessionKey.split(':');
  return agentId || 'main';
}

function getAgentColor(name: string): string {
  const colors = [
    'linear-gradient(135deg, #039fff, #baafff)',
    'linear-gradient(135deg, #ff6b9d, #c849f4)',
    'linear-gradient(135deg, #00c6fb, #005bea)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ── AgentAvatar ────────────────────────────────────────────────
function AgentAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const initial = name ? name.charAt(0).toUpperCase() : 'A';
  const gradient = getAgentColor(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: size * 0.38,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

// ── AgentBadge ─────────────────────────────────────────────────
// 长条形圆角显示Agent全名称
function AgentBadge({ name }: { name: string }) {
  return (
    <div
      className="inline-flex items-center h-6 px-3 rounded-full shrink-0 dark"
      style={{
        background: 'rgba(255,255,255,0.08)',
        color: 'var(--theme-text-secondary)',
        fontSize: 11,
        fontWeight: 500,
      }}
    >
      {name}
    </div>
  );
}

// ── Main Sidebar ───────────────────────────────────────────────
export function Sidebar() {
  const { t } = useTranslation(['common', 'chat']);
  const navigate = useNavigate();
  const location = useLocation();

  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed);
  
  // 左侧图标栏折叠状态
  const [iconsCollapsed, setIconsCollapsed] = useState(false);

  const sessions = useChatStore((s) => s.sessions);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const sessionLabels = useChatStore((s) => s.sessionLabels);
  const sessionCustomLabels = useChatStore((s) => s.sessionCustomLabels);
  const sessionLastActivity = useChatStore((s) => s.sessionLastActivity);
  const sessionUnreadCounts = useChatStore((s) => s.sessionUnreadCounts);
  const clearUnreadCount = useChatStore((s) => s.clearUnreadCount);
  const switchSession = useChatStore((s) => s.switchSession);
  const newSession = useChatStore((s) => s.newSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const loadHistory = useChatStore((s) => s.loadHistory);
  const currentAgentId = useChatStore((s) => s.currentAgentId);

  const gatewayStatus = useGatewayStore((s) => s.status);
  const isGatewayRunning = gatewayStatus.state === 'running';

  const agents = useAgentsStore((s) => s.agents);
  const fetchAgents = useAgentsStore((s) => s.fetchAgents);

  const [sessionToDelete, setSessionToDelete] = useState<{ key: string; label: string } | null>(null);
  const [nowMs, setNowMs] = useState(INITIAL_NOW_MS);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set(['main']));
  const [agentsListCollapsed, setAgentsListCollapsed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // 监听 sidebar-icons-state 事件（来自 ChatToolbar 同步 iconsCollapsed 状态）
  useEffect(() => {
    const handleIconsState = (e: Event) => {
      const customEvent = e as CustomEvent<{ iconsCollapsed: boolean }>;
      setIconsCollapsed(customEvent.detail.iconsCollapsed);
    };
    window.addEventListener('sidebar-icons-state', handleIconsState);
    return () => window.removeEventListener('sidebar-icons-state', handleIconsState);
  }, []);

  // 监听 sidebarCollapsed 变化 - 仅在展开时恢复图标栏
  useEffect(() => {
    if (!sidebarCollapsed) {
      // 完全展开时，图标栏也要展开
      setIconsCollapsed(false);
    }
  }, [sidebarCollapsed]);

  // 初始化 iconsCollapsed 状态
  useEffect(() => {
    const stored = localStorage.getItem('sidebar-icons-collapsed');
    if (stored === 'true') setIconsCollapsed(true);
  }, []);


  // 所有 agent 项（含 main）
  useEffect(() => {
    if (!isGatewayRunning) return;
    let cancelled = false;
    const hasExistingMessages = useChatStore.getState().messages.length > 0;
    (async () => {
      await loadSessions();
      if (cancelled) return;
      await loadHistory(hasExistingMessages);
    })();
    return () => { cancelled = true; };
  }, [isGatewayRunning, loadHistory, loadSessions]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetchAgents();
  }, [fetchAgents]);

  const agentNameById = useMemo(
    () => Object.fromEntries((agents ?? []).map((a) => [a.id, a.name])),
    [agents],
  );

  // Get session display label: prioritize custom label > auto-generated label > displayName > key
  const getSessionLabel = (key: string, displayName?: string, label?: string) =>
    sessionCustomLabels[key] ?? sessionLabels[key] ?? label ?? displayName ?? key;

  const openDevConsole = async () => {
    try {
      const result = await hostApiFetch<{ success: boolean; url?: string }>('/api/gateway/control-ui');
      if (result.success && result.url) window.electron.openExternal(result.url);
    } catch (err) {
      console.error('Error opening Dev Console:', err);
    }
  };

  const currentPage: NavPage = (() => {
    if (location.pathname === '/' || location.pathname.startsWith('/chat')) return 'chat';
    if (location.pathname.startsWith('/models')) return 'models';
    if (location.pathname.startsWith('/studio')) return 'agents'; // 工作室用 agents 图标高亮
    if (location.pathname.startsWith('/agents')) return 'agents';
    if (location.pathname.startsWith('/channels')) return 'channels';
    if (location.pathname.startsWith('/skills')) return 'skills';
    if (location.pathname.startsWith('/cron')) return 'cron';
    if (location.pathname.startsWith('/settings')) return 'settings';
    if (location.pathname.startsWith('/logs')) return 'logs';
    if (location.pathname.startsWith('/config')) return 'config';
    return 'chat';
  })();

  // 非对话页面点击时收起整个侧边栏
  useEffect(() => {
    if (currentPage !== 'chat') {
      setSidebarCollapsed(true);
    }
  }, [currentPage]);

  // 按 agent 分组 sessions，并分离群聊
  const sessionsByAgent = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const s of sessions) {
      // 跳过群聊会话（单独处理）
      if (s.key.startsWith('group:')) continue;
      const agentId = getAgentIdFromSessionKey(s.key);
      if (!map.has(agentId)) map.set(agentId, []);
      map.get(agentId)!.push(s);
    }
    // 按最近活动时间排序
    for (const [, list] of map) {
      list.sort((a, b) => (sessionLastActivity[b.key] ?? 0) - (sessionLastActivity[a.key] ?? 0));
    }
    return map;
  }, [sessions, sessionLastActivity]);

  // 搜索过滤
  const filteredAllSessions = searchQuery.trim()
    ? sessions.filter((s) => {
        const label = getSessionLabel(s.key, s.displayName, s.label).toLowerCase();
        const agentId = getAgentIdFromSessionKey(s.key);
        const agentName = (agentNameById[agentId] || agentId).toLowerCase();
        return label.includes(searchQuery.toLowerCase()) || agentName.includes(searchQuery.toLowerCase());
      })
    : null;

  // 切换 agent 展开/折叠
  const toggleAgent = (agentId: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  // 新建会话
  const handleNewSession = (agentId: string) => {
    useChatStore.setState({ currentAgentId: agentId });
    void newSession();
    navigate('/');
  };

  // 选择会话 - 清除未读计数
  const handleSelectSession = (sessionKey: string, agentId: string) => {
    useChatStore.setState({ currentAgentId: agentId });
    clearUnreadCount(sessionKey);
    switchSession(sessionKey);
    navigate('/');
  };

  // 重命名会话 - 保存到 sessionCustomLabels 以持久化用户备注
  const renameSession = (key: string, newLabel: string) => {
    useChatStore.setState((s) => ({
      sessionCustomLabels: { ...s.sessionCustomLabels, [key]: newLabel },
    }));
  };

  // 所有 agent 项（含 main）
  // API 已返回 main，不要重复添加；只补一个 MClaw 名称的 main
  const allAgentItems = useMemo(() => {
    const items: { id: string; name: string; isMain: boolean }[] = [];
    const hasMain = (agents ?? []).some((a) => a.id === 'main');
    if (!hasMain) {
      items.push({ id: 'main', name: 'MClaw', isMain: true });
    }
    for (const a of agents ?? []) {
      // main 用 MClaw 名称展示
      items.push({
        id: a.id,
        name: a.id === 'main' ? 'MClaw' : a.name,
        isMain: a.id === 'main',
      });
    }
    return items;
  }, [agents]);

  // 桶标签映射
  const bucketLabelMap: Record<SessionBucketKey, string> = {
    today: t('chat:historyBuckets.today'),
    yesterday: t('chat:historyBuckets.yesterday'),
    withinWeek: t('chat:historyBuckets.withinWeek'),
    older: t('chat:historyBuckets.older'),
  };

  // 点击图标按钮时：如果完全收起则展开，否则直接导航
  const handleIconNav = (path: string) => {
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
    navigate(path);
  };

  return (
    <>
      {/* ===== 整体布局：左侧竖排图标 + 主侧边栏 ===== */}
      <div className="flex h-full">
        {/* ---- 左侧竖排图标栏（52px） ---- */}
        <div
          className="flex flex-col items-center shrink-0 py-3 gap-1.5"
          style={{
            width: iconsCollapsed ? 0 : 52,
            background: 'var(--theme-sidebar-bg)',
            borderRight: iconsCollapsed ? 'none' : '1px solid var(--theme-border)',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
          }}
        >
          {/* 顶部占位 - 保持与右侧顶栏对齐 */}
          <div style={{ height: 44 }} />

          <div className="w-6 border-t my-1.5" style={{ borderColor: 'var(--theme-border)', opacity: 0.4 }} />

          {/* 对话 - 首页 */}
          <LeftNavButton
            icon={<MessageCircle className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label="对话"
            active={currentPage === 'chat'}
            onClick={() => handleIconNav('/')}
          />
          {/* 工作室 */}
          <LeftNavButton
            icon={<Laptop className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label="工作室"
            active={location.pathname.startsWith('/studio')}
            onClick={() => handleIconNav('/studio')}
          />

          <div className="w-6 border-t my-1" style={{ borderColor: 'var(--theme-border)', opacity: 0.4 }} />

          {/* 竖排导航按钮 */}
          <LeftNavButton
            icon={<Cpu className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label={t('sidebar.models')}
            active={currentPage === 'models'}
            onClick={() => handleIconNav('/models')}
          />
          <LeftNavButton
            icon={<Network className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label={t('sidebar.channels')}
            active={currentPage === 'channels'}
            onClick={() => handleIconNav('/channels')}
          />
          <LeftNavButton
            icon={<Puzzle className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label={t('sidebar.skills')}
            active={currentPage === 'skills'}
            onClick={() => handleIconNav('/skills')}
          />
          <LeftNavButton
            icon={<Clock className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label={t('sidebar.cronTasks')}
            active={currentPage === 'cron'}
            onClick={() => handleIconNav('/cron')}
          />
          <LeftNavButton
            icon={<Bot className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label={t('sidebar.agents')}
            active={currentPage === 'agents'}
            onClick={() => handleIconNav('/agents')}
          />

          <div className="flex-1" />

          {/* 底部四个：配置 + 日志 + 终端 + 设置 */}
          <LeftNavButton
            icon={<FolderCog className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label="配置"
            active={currentPage === 'config'}
            onClick={() => handleIconNav('/config')}
          />
          <LeftNavButton
            icon={<FileText className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label="日志"
            active={currentPage === 'logs'}
            onClick={() => handleIconNav('/logs')}
          />
          <LeftNavButton
            icon={<Terminal className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label={t('common:sidebar.openClawPage')}
            onClick={() => {
              if (sidebarCollapsed) setSidebarCollapsed(false);
              openDevConsole();
            }}
          />
          <LeftNavButton
            icon={<SettingsIcon className="h-[20px] w-[20px]" strokeWidth={1.8} />}
            label={t('sidebar.settings')}
            active={currentPage === 'settings'}
            onClick={() => handleIconNav('/settings')}
          />
        </div>

        {/* ---- 主侧边栏（会话列表） ---- */}
        <aside
          data-testid="sidebar"
          className={cn(
            'flex flex-col overflow-hidden transition-all duration-300',
            'bg-[var(--theme-sidebar-bg)]',
            sidebarCollapsed ? 'w-0' : 'w-[220px]',
          )}
          style={{ borderRight: '1px solid var(--theme-border)' }}
        >
          {/* 搜索框 */}
          <div className="px-3 pt-3 pb-2 shrink-0">
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                style={{ color: 'var(--theme-text-muted)' }}
              />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('chat:historyPanel.search') || '搜索...'}
                className="w-full rounded-lg pl-8 pr-7 py-1.5 text-[12px] outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid transparent',
                  color: 'var(--theme-text-primary)',
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--theme-accent-blue)';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* 会话列表（可滚动） */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
            {/* 搜索结果模式 */}
            {searchQuery && filteredAllSessions && (
              <div>
                {filteredAllSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <MessageSquare className="h-7 w-7" style={{ color: 'var(--theme-text-muted)', opacity: 0.4 }} />
                    <span className="text-[12px]" style={{ color: 'var(--theme-text-muted)' }}>
                      {t('chat:historyPanel.noResults') || '无结果'}
                    </span>
                  </div>
                ) : (
                  filteredAllSessions.map((s) => {
                    const agentId = getAgentIdFromSessionKey(s.key);
                    return (
                      <SessionItem
                        key={s.key}
                        sessionKey={s.key}
                        label={getSessionLabel(s.key, s.displayName, s.label)}
                        agentId={agentId}
                        agentName={agentNameById[agentId] || agentId}
                        isActive={currentSessionKey === s.key}
                        onSelect={() => handleSelectSession(s.key, agentId)}
                        onDelete={() => setSessionToDelete({ key: s.key, label: getSessionLabel(s.key, s.displayName, s.label) })}
                        onRename={(newLabel) => renameSession(s.key, newLabel)}
                        compact
                        unreadCount={sessionUnreadCounts[s.key] || 0}
                      />
                    );
                  })
                )}
              </div>
            )}

            {/* Agent 树形列表模式 */}
            {!searchQuery && (
              <div className="flex flex-col">
                {/* 折叠/展开整个列表的按钮 */}
                <button
                  onClick={() => setAgentsListCollapsed(!agentsListCollapsed)}
                  className="w-full flex items-center justify-between px-2 py-2 rounded-xl mb-1 transition-all duration-150"
                  style={{ 
                    background: agentsListCollapsed ? 'rgba(255,255,255,0.03)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = agentsListCollapsed ? 'rgba(255,255,255,0.03)' : 'transparent'; }}
                >
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" style={{ color: 'var(--theme-text-muted)' }} />
                    <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                      Agents ({allAgentItems.length})
                    </span>
                  </div>
                  {agentsListCollapsed ? (
                    <ChevronRight className="h-4 w-4" style={{ color: 'var(--theme-text-muted)' }} />
                  ) : (
                    <ChevronDown className="h-4 w-4" style={{ color: 'var(--theme-text-muted)' }} />
                  )}
                </button>

                {/* Agent 列表内容 */}
                {!agentsListCollapsed && (
                  <div className="flex flex-col gap-0.5">
                    {allAgentItems.map((item) => {
                  const isExpanded = expandedAgents.has(item.id);
                  const agentSessions = sessionsByAgent.get(item.id) ?? [];

                  // 分桶
                  const bucketMap = new Map<SessionBucketKey, typeof agentSessions>();
                  for (const s of agentSessions) {
                    const bucket = getSessionBucket(sessionLastActivity[s.key] ?? 0, nowMs);
                    if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
                    bucketMap.get(bucket)!.push(s);
                  }
                  const orderedBuckets: SessionBucketKey[] = ['today', 'yesterday', 'withinWeek', 'older'];

                  return (
                    <div key={item.id} className="agent-group">
                      {/* Agent 行（可点击展开） */}
                      <button
                        className={cn(
                          'w-full flex items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-all duration-150',
                          isExpanded
                            ? 'text-[var(--theme-text-primary)] font-medium'
                            : 'text-[var(--theme-text-secondary)]',
                        )}
                        style={{ minHeight: 36 }}
                        onClick={() => toggleAgent(item.id)}
                        onMouseEnter={(e) => {
                          if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'var(--theme-session-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isExpanded) (e.currentTarget as HTMLElement).style.background = '';
                        }}
                      >
                        {/* 展开箭头 */}
                        <span className="shrink-0" style={{ color: 'var(--theme-text-muted)' }}>
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </span>

                        {/* Agent 名称长条形标签 */}
                        <AgentBadge name={item.name} />

                        {/* 展开时显示 + 按钮 */}
                        {isExpanded && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleNewSession(item.id); }}
                            className="shrink-0 flex items-center justify-center h-5 w-5 rounded-md transition-colors"
                            style={{ color: 'var(--theme-text-muted)' }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
                              (e.currentTarget as HTMLElement).style.color = 'var(--theme-accent-blue)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = '';
                              (e.currentTarget as HTMLElement).style.color = 'var(--theme-text-muted)';
                            }}
                            title="新建会话"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* 有会话时显示计数 */}
                        {!isExpanded && agentSessions.length > 0 && (
                          <span
                            className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(255,255,255,0.1)',
                              color: 'var(--theme-text-muted)',
                              fontSize: 10,
                            }}
                          >
                            {agentSessions.length}
                          </span>
                        )}
                      </button>

                      {/* 展开的会话列表 */}
                      {isExpanded && (
                        <div className="flex flex-col gap-0.5 mt-0.5 mb-1 pl-2">
                          {agentSessions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-4 gap-1.5">
                              <MessageSquare className="h-5 w-5" style={{ color: 'var(--theme-text-muted)', opacity: 0.3 }} />
                              <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                                暂无会话
                              </span>
                              <button
                                onClick={() => handleNewSession(item.id)}
                                className="text-[11px] px-3 py-1 rounded-full transition-colors"
                                style={{ color: 'var(--theme-accent-blue)', background: 'rgba(10,132,255,0.15)' }}
                              >
                                新建对话
                              </button>
                            </div>
                          ) : (
                            orderedBuckets.map((bucketKey) => {
                              const bucketSessions = bucketMap.get(bucketKey);
                              if (!bucketSessions || bucketSessions.length === 0) return null;
                              return (
                                <div key={bucketKey}>
                                  <div
                                    className="text-[10px] font-medium px-2 py-1 uppercase tracking-wide"
                                    style={{ color: 'var(--theme-text-muted)' }}
                                  >
                                    {bucketLabelMap[bucketKey]}
                                  </div>
                                  {bucketSessions.map((s) => (
                                    <SessionItem
                                      key={s.key}
                                      sessionKey={s.key}
                                      label={getSessionLabel(s.key, s.displayName, s.label)}
                                      agentId={item.id}
                                      agentName={item.name}
                                      isActive={currentSessionKey === s.key}
                                      onSelect={() => handleSelectSession(s.key, item.id)}
                                      onDelete={() => setSessionToDelete({ key: s.key, label: getSessionLabel(s.key, s.displayName, s.label) })}
                                      onRename={(newLabel) => renameSession(s.key, newLabel)}
                                      compact
                                      showSummary
                                      unreadCount={sessionUnreadCounts[s.key] || 0}
                                    />
                                  ))}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                  </div>
                )}

              </div>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={!!sessionToDelete}
        title={t('common:actions.confirm')}
        message={t('common:sidebar.deleteSessionConfirm', { label: sessionToDelete?.label })}
        confirmLabel={t('common:actions.delete')}
        cancelLabel={t('common:actions.cancel')}
        variant="destructive"
        onConfirm={async () => {
          if (!sessionToDelete) return;
          await deleteSession(sessionToDelete.key);
          const { currentSessionKey: csk } = useChatStore.getState();
          if (csk === sessionToDelete.key) navigate('/');
          setSessionToDelete(null);
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </>
  );
}

// ── SessionItem ────────────────────────────────────────────────
const SessionItem = memo(function SessionItem({
  label,
  sessionKey: _sessionKey,
  agentId: _agentId,
  agentName: _agentName,
  isActive,
  onSelect,
  onDelete,
  onRename,
  compact = false,
  showSummary: _showSummary = false,
  unreadCount = 0,
}: {
  label: string;
  sessionKey: string;
  agentId: string;
  agentName: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newLabel: string) => void;
  compact?: boolean;
  showSummary?: boolean;
  unreadCount?: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  // 截取标签作为唯一标题
  const titleText = label.length > 20 ? label.substring(0, 20) + '...' : label;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center px-2 py-1">
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setIsEditing(false); setEditValue(label); }
          }}
          className="w-full text-[12px] px-2 py-1 rounded-lg border outline-none bg-white dark:bg-gray-800"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  }

  return (
    <div className="group relative flex items-center">
      <button
        onClick={onSelect}
        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditValue(label); }}
        className={cn(
          'w-full text-left rounded-[18px] px-3 py-0 flex items-center gpu-accelerated',
          compact ? 'min-h-[32px] text-[12px]' : 'min-h-[36px] text-[13px]',
          isActive
            ? 'text-[var(--theme-text-primary)] font-medium'
            : 'text-[var(--theme-text-secondary)]',
        )}
        style={{
          background: isActive ? 'var(--theme-session-active)' : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--theme-session-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLElement).style.background = '';
        }}
      >
        <div className="shrink-0 mr-2">
          <MessageSquare className="opacity-50" style={{ width: 12, height: 12 }} />
        </div>
        <span className="truncate leading-5">{titleText}</span>
      </button>

      {/* Unread badge - always visible when has unread, positioned at top-left of session item */}
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -left-1 bg-red-400 text-white text-[9px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center shadow-sm animate-bounce-in z-10"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      {/* Action buttons on hover */}
      <div className="absolute right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Rename button */}
        <button
          aria-label="Rename"
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditValue(label); }}
          className="flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--theme-text-muted)', height: 20, width: 20 }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.15)';
            (e.currentTarget as HTMLElement).style.color = 'var(--theme-accent-blue)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = '';
            (e.currentTarget as HTMLElement).style.color = 'var(--theme-text-muted)';
          }}
        >
          <Pencil className="h-3 w-3" />
        </button>
        {/* Delete button */}
        <button
          aria-label="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex items-center justify-center rounded-lg transition-all"
          style={{ color: 'var(--theme-text-muted)', height: 20, width: 20 }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(243,139,168,0.15)';
            (e.currentTarget as HTMLElement).style.color = '#f38ba8';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = '';
            (e.currentTarget as HTMLElement).style.color = 'var(--theme-text-muted)';
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});

// ── LeftNavButton ──────────────────────────────────────────────
const LeftNavButton = memo(function LeftNavButton({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl transition-all duration-150 gap-0.5 gpu-accelerated',
        active
          ? 'text-[var(--theme-accent-blue)]'
          : 'text-[var(--theme-text-muted)] hover:bg-[var(--theme-session-hover)]',
      )}
      style={{ width: 44, height: 48, padding: '6px 0 2px' }}
    >
      {icon}
      <span className="text-[9px] font-medium leading-none truncate w-full text-center px-0.5">
        {label}
      </span>
    </button>
  );
});
