/**
 * Agent Session List Component
 * Displays a list of agent sessions with search, grouping, and sorting
 */
import { memo, useMemo, useState, useCallback } from 'react';
import { Plus, Search, Bot, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AgentSessionCard, type AgentSession } from './AgentSessionCard';
import { AgentSessionFilter, type FilterState } from './AgentSessionFilter';

interface AgentSessionListProps {
  sessions: AgentSession[];
  selectedSessionId?: string;
  onSelectSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onOpenChat?: (sessionId: string) => void;
  onNewSession?: () => void;
  loading?: boolean;
}

interface GroupedSessions {
  agentId: string;
  agentName: string;
  sessions: AgentSession[];
}

/**
 * Group sessions by agent
 */
function groupSessionsByAgent(sessions: AgentSession[]): GroupedSessions[] {
  const groups = new Map<string, GroupedSessions>();

  for (const session of sessions) {
    const existing = groups.get(session.agentId);
    if (existing) {
      existing.sessions.push(session);
    } else {
      groups.set(session.agentId, {
        agentId: session.agentId,
        agentName: session.agentName,
        sessions: [session],
      });
    }
  }

  // Sort sessions within each group by last activity
  for (const group of groups.values()) {
    group.sessions.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  // Sort groups by most recent activity
  return Array.from(groups.values()).sort((a, b) => {
    const aLatest = a.sessions[0]?.lastActivity ?? 0;
    const bLatest = b.sessions[0]?.lastActivity ?? 0;
    return bLatest - aLatest;
  });
}

/**
 * Sort sessions based on sort option
 */
function sortSessions(sessions: AgentSession[], sortBy: FilterState['sortBy']): AgentSession[] {
  const sorted = [...sessions];

  switch (sortBy) {
    case 'lastActivity':
      return sorted.sort((a, b) => b.lastActivity - a.lastActivity);
    case 'createdAt':
      return sorted.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    case 'messageCount':
      return sorted.sort((a, b) => b.messageCount - a.messageCount);
    default:
      return sorted;
  }
}

export const AgentSessionList = memo(function AgentSessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
  onDeleteSession,
  onOpenChat,
  onNewSession,
  loading = false,
}: AgentSessionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState<FilterState>({
    agentId: undefined,
    status: 'all',
    sortBy: 'lastActivity',
  });
  const [groupByAgent, setGroupByAgent] = useState(true);

  /**
   * Filter and sort sessions
   */
  const processedSessions = useMemo(() => {
    let filtered = sessions;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.displayName.toLowerCase().includes(query) ||
          s.agentName.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterState.status !== 'all') {
      filtered = filtered.filter((s) => s.status === filterState.status);
    }

    // Agent filter
    if (filterState.agentId) {
      filtered = filtered.filter((s) => s.agentId === filterState.agentId);
    }

    return filtered;
  }, [sessions, searchQuery, filterState]);

  /**
   * Sort sessions
   */
  const sortedSessions = useMemo(
    () => sortSessions(processedSessions, filterState.sortBy),
    [processedSessions, filterState.sortBy]
  );

  /**
   * Group sessions by agent
   */
  const groupedSessions = useMemo(() => {
    if (!groupByAgent) return null;
    return groupSessionsByAgent(sortedSessions);
  }, [sortedSessions, groupByAgent]);

  /**
   * Get unique agents for filter dropdown
   */
  const agents = useMemo(() => {
    const agentMap = new Map<string, { id: string; name: string }>();
    for (const session of sessions) {
      if (!agentMap.has(session.agentId)) {
        agentMap.set(session.agentId, { id: session.agentId, name: session.agentName });
      }
    }
    return Array.from(agentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const handleFilterChange = useCallback((newState: FilterState) => {
    setFilterState(newState);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-[14px]">加载中...</p>
      </div>
    );
  }

  // Empty state - no sessions at all
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Inbox className="h-8 w-8" />
        </div>
        <h3 className="text-[16px] font-medium text-foreground mb-1">暂无会话</h3>
        <p className="text-[14px] text-muted-foreground mb-4">
          开始一个新的 Agent 会话来体验智能对话
        </p>
        <Button onClick={onNewSession} className="gap-2">
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
      </div>
    );
  }

  // Empty state - no results from filter
  if (sortedSessions.length === 0) {
    return (
      <div className="space-y-4">
        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索会话..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={onNewSession} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            新建会话
          </Button>
        </div>

        <AgentSessionFilter
          agents={agents}
          state={filterState}
          onChange={handleFilterChange}
          groupByAgent={groupByAgent}
          onToggleGroupByAgent={() => setGroupByAgent((v) => !v)}
        />

        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mb-4 opacity-50" />
          <p className="text-[14px]">没有匹配的会话</p>
          <p className="text-[12px] mt-1">尝试修改搜索条件</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and New Session Button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索会话..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={onNewSession} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
      </div>

      {/* Filter Bar */}
      <AgentSessionFilter
        agents={agents}
        state={filterState}
        onChange={handleFilterChange}
        groupByAgent={groupByAgent}
        onToggleGroupByAgent={() => setGroupByAgent((v) => !v)}
      />

      {/* Session Count */}
      <div className="text-[12px] text-muted-foreground">
        共 {sortedSessions.length} 个会话
        {filterState.status !== 'all' && ` · ${filterState.status === 'active' ? '活跃' : filterState.status === 'idle' ? '空闲' : '错误'}`}
        {filterState.agentId && ` · ${agents.find((a) => a.id === filterState.agentId)?.name}`}
      </div>

      {/* Sessions List */}
      {groupByAgent && groupedSessions ? (
        // Grouped View
        <div className="space-y-6">
          {groupedSessions.map((group) => (
            <div key={group.agentId} className="space-y-2">
              {/* Group Header */}
              <div className="flex items-center gap-2 px-1">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px] font-medium text-foreground">
                  {group.agentName}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {group.sessions.length} 个会话
                </span>
              </div>

              {/* Sessions in Group */}
              <div className="space-y-2">
                {group.sessions.map((session) => (
                  <AgentSessionCard
                    key={session.id}
                    session={session}
                    isSelected={selectedSessionId === session.id}
                    onSelect={onSelectSession}
                    onDelete={onDeleteSession}
                    onOpenChat={onOpenChat}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Flat View
        <div className="space-y-2">
          {sortedSessions.map((session) => (
            <AgentSessionCard
              key={session.id}
              session={session}
              isSelected={selectedSessionId === session.id}
              onSelect={onSelectSession}
              onDelete={onDeleteSession}
              onOpenChat={onOpenChat}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default AgentSessionList;
