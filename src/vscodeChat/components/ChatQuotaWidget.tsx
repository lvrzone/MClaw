/**
 * ChatQuotaWidget - 配额显示组件
 * 移植自 VS Code Chat quotaWidget
 */
import { useMemo } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

// 配额信息
export interface QuotaInfo {
  used: number;
  limit: number;
  resetAt?: number; // 重置时间戳
  model?: string;
}

// 格式化数字
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

// 格式化时间
function formatResetTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  
  if (diff < 0) return '已重置';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} 天后重置`;
  }
  if (hours > 0) {
    return `${hours} 小时后重置`;
  }
  return `${minutes} 分钟后重置`;
}

// 计算百分比
function getPercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min((used / limit) * 100, 100);
}

// 获取状态颜色
function getStatusColor(percentage: number): string {
  if (percentage >= 90) return 'var(--vscode-chat-error)';
  if (percentage >= 70) return 'var(--vscode-chat-warning)';
  return 'var(--vscode-chat-success)';
}

// ChatQuotaWidget Props
interface ChatQuotaWidgetProps {
  quota: QuotaInfo;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

// ChatQuotaWidget 组件
export function ChatQuotaWidget({
  quota,
  compact = false,
  showLabel = true,
  className = '',
}: ChatQuotaWidgetProps) {
  const percentage = useMemo(() => 
    getPercentage(quota.used, quota.limit), 
    [quota.used, quota.limit]
  );
  
  const statusColor = useMemo(() => 
    getStatusColor(percentage), 
    [percentage]
  );
  
  const resetTime = useMemo(() => 
    formatResetTime(quota.resetAt), 
    [quota.resetAt]
  );
  
  const isLow = percentage >= 80;
  
  if (compact) {
    return (
      <div className={`vscode-chat-quota-compact ${className}`} title={`已用 ${formatNumber(quota.used)} / ${formatNumber(quota.limit)}`}>
        <Zap size={12} style={{ color: statusColor }} />
        <span className="vscode-chat-quota-compact-text">
          {formatNumber(quota.used)}
        </span>
        {isLow && <AlertTriangle size={10} style={{ color: 'var(--vscode-chat-warning)' }} />}
      </div>
    );
  }
  
  return (
    <div className={`vscode-chat-quota-widget ${isLow ? 'low' : ''} ${className}`}>
      {showLabel && (
        <div className="vscode-chat-quota-header">
          <Zap size={14} />
          <span>配额</span>
          {quota.model && (
            <span className="vscode-chat-quota-model">{quota.model}</span>
          )}
        </div>
      )}
      
      <div className="vscode-chat-quota-bar">
        <div className="vscode-chat-quota-bar-bg">
          <div 
            className="vscode-chat-quota-bar-fill"
            style={{ 
              width: `${percentage}%`,
              backgroundColor: statusColor,
            }}
          />
        </div>
      </div>
      
      <div className="vscode-chat-quota-footer">
        <span className="vscode-chat-quota-used">
          {formatNumber(quota.used)} / {formatNumber(quota.limit)}
        </span>
        {resetTime && (
          <span className="vscode-chat-quota-reset">{resetTime}</span>
        )}
      </div>
      
      {isLow && (
        <div className="vscode-chat-quota-warning">
          <AlertTriangle size={12} />
          <span>配额即将用尽</span>
        </div>
      )}
    </div>
  );
}

export default ChatQuotaWidget;
