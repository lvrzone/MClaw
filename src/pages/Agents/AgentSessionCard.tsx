/**
 * Agent Session Card Component
 * Displays a single agent session with status, actions, and expandable details
 */
import { memo, useState, useCallback, useMemo } from 'react';
import { Bot, MessageSquare, Clock, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface AgentSession {
  id: string;
  agentId: string;
  agentName: string;
  displayName: string;
  status: 'active' | 'idle' | 'error';
  lastActivity: number; // timestamp ms
  messageCount: number;
  model?: string;
  thinkingLevel?: string;
  createdAt?: number;
}

interface AgentSessionCardProps {
  session: AgentSession;
  isSelected?: boolean;
  onSelect?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
  onOpenChat?: (sessionId: string) => void;
}

/**
 * Format timestamp to relative time string
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return '刚刚';
  } else if (diffMin < 60) {
    return `${diffMin} 分钟前`;
  } else if (diffHour < 24) {
    return `${diffHour} 小时前`;
  } else if (diffDay < 7) {
    return `${diffDay} 天前`;
  } else {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  }
}

/**
 * Get status badge variant and label
 */
function getStatusConfig(status: AgentSession['status']) {
  switch (status) {
    case 'active':
      return { variant: 'success' as const, label: '活跃', dotColor: 'bg-green-500' };
    case 'idle':
      return { variant: 'secondary' as const, label: '空闲', dotColor: 'bg-gray-400' };
    case 'error':
      return { variant: 'destructive' as const, label: '错误', dotColor: 'bg-red-500' };
    default:
      return { variant: 'secondary' as const, label: '未知', dotColor: 'bg-gray-400' };
  }
}

export const AgentSessionCard = memo(function AgentSessionCard({
  session,
  isSelected = false,
  onSelect,
  onDelete,
  onOpenChat,
}: AgentSessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleSelect = useCallback(() => {
    onSelect?.(session.id);
  }, [onSelect, session.id]);

  const handleDelete = useCallback(() => {
    onDelete?.(session.id);
  }, [onDelete, session.id]);

  const handleOpenChat = useCallback(() => {
    onOpenChat?.(session.id);
  }, [onOpenChat, session.id]);

  const statusConfig = useMemo(() => getStatusConfig(session.status), [session.status]);
  const relativeTime = useMemo(() => formatRelativeTime(session.lastActivity), [session.lastActivity]);

  const hasDetails = session.model || session.thinkingLevel;

  return (
    <Card
      className={cn(
        'group transition-all duration-200 cursor-pointer',
        'border-transparent hover:border-black/10 dark:hover:border-white/10',
        'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
        isSelected && 'border-primary/50 bg-primary/5'
      )}
      onClick={handleSelect}
    >
      <CardContent className="p-4">
        {/* Main Content Row */}
        <div className="flex items-start gap-3">
          {/* Agent Avatar */}
          <div className="h-10 w-10 shrink-0 flex items-center justify-center bg-primary/10 rounded-full">
            <Bot className="h-5 w-5 text-primary" />
          </div>

          {/* Session Info */}
          <div className="flex-1 min-w-0">
            {/* Header: Name + Status */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[15px] font-semibold text-foreground truncate">
                {session.displayName}
              </h3>
              <Badge variant={statusConfig.variant} className="text-[10px] px-1.5 py-0">
                <span className={cn('w-1.5 h-1.5 rounded-full mr-1', statusConfig.dotColor)} />
                {statusConfig.label}
              </Badge>
            </div>

            {/* Agent Name */}
            <p className="text-[13px] text-muted-foreground mb-1">
              {session.agentName}
            </p>

            {/* Stats Row */}
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {relativeTime}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {session.messageCount} 条消息
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenChat();
              }}
              title="打开聊天"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              title="删除会话"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Expandable Details */}
        {hasDetails && (
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleExpand();
              }}
              className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <span>详情</span>
            </button>

            {isExpanded && (
              <div className="mt-2 pl-5 space-y-1 text-[12px]">
                {session.model && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">模型:</span>
                    <span className="font-mono text-foreground">{session.model}</span>
                  </div>
                )}
                {session.thinkingLevel && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">思考级别:</span>
                    <span className="text-foreground">{session.thinkingLevel}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default AgentSessionCard;
