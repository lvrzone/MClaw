/**
 * Agent Session Filter Component
 * Provides filtering and sorting options for agent sessions
 */
import { memo, useCallback } from 'react';
import { Filter, ArrowUpDown, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';

export interface FilterState {
  agentId?: string;
  status: 'all' | 'active' | 'idle' | 'error';
  sortBy: 'lastActivity' | 'createdAt' | 'messageCount';
}

interface AgentOption {
  id: string;
  name: string;
}

interface AgentSessionFilterProps {
  agents: AgentOption[];
  state: FilterState;
  onChange: (state: FilterState) => void;
  groupByAgent?: boolean;
  onToggleGroupByAgent?: () => void;
}

export const AgentSessionFilter = memo(function AgentSessionFilter({
  agents,
  state,
  onChange,
  groupByAgent = true,
  onToggleGroupByAgent,
}: AgentSessionFilterProps) {
  const handleAgentChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      onChange({
        ...state,
        agentId: value === 'all' ? undefined : value,
      });
    },
    [onChange, state]
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      onChange({
        ...state,
        status: value as FilterState['status'],
      });
    },
    [onChange, state]
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      onChange({
        ...state,
        sortBy: value as FilterState['sortBy'],
      });
    },
    [onChange, state]
  );

  const handleReset = useCallback(() => {
    onChange({
      agentId: undefined,
      status: 'all',
      sortBy: 'lastActivity',
    });
  }, [onChange]);

  const hasActiveFilters = state.agentId !== undefined || state.status !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-muted/50 border border-transparent">
      {/* Filter Icon */}
      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

      {/* Agent Filter */}
      <Select
        value={state.agentId || 'all'}
        onChange={handleAgentChange}
        className="w-[140px] h-8 text-[12px]"
      >
        <option value="all">所有 Agent</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </Select>

      {/* Status Filter */}
      <Select
        value={state.status}
        onChange={handleStatusChange}
        className="w-[100px] h-8 text-[12px]"
      >
        <option value="all">全部状态</option>
        <option value="active">活跃</option>
        <option value="idle">空闲</option>
        <option value="error">错误</option>
      </Select>

      {/* Sort */}
      <div className="flex items-center gap-1.5">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        <Select
          value={state.sortBy}
          onChange={handleSortChange}
          className="w-[120px] h-8 text-[12px]"
        >
          <option value="lastActivity">最近活跃</option>
          <option value="createdAt">创建时间</option>
          <option value="messageCount">消息数量</option>
        </Select>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border mx-1" />

      {/* Group Toggle */}
      {onToggleGroupByAgent && (
        <Button
          variant={groupByAgent ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 px-2.5 text-[12px] gap-1.5"
          onClick={onToggleGroupByAgent}
        >
          <Layers className="h-3.5 w-3.5" />
          分组
        </Button>
      )}

      {/* Reset Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
          onClick={handleReset}
        >
          重置
        </Button>
      )}

      {/* Active Filter Count */}
      {hasActiveFilters && (
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {(state.agentId ? 1 : 0) + (state.status !== 'all' ? 1 : 0)}
        </Badge>
      )}
    </div>
  );
});

export default AgentSessionFilter;
