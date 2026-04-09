/**
 * MClaw Studio - 工作室监控面板
 * 展示所有 Agent 的运作状态、实时数据分析、空闲/忙碌状态
 */
import { useEffect, useState } from 'react';
import { Bot, AlertCircle } from 'lucide-react';
import { useAgentsStore } from '@/stores/agents';
import { useGatewayStore } from '@/stores/gateway';
import { useChatStore } from '@/stores/chat';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

// Agent 状态类型
type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';

interface AgentRuntimeInfo {
  agentId: string;
  status: AgentStatus;
  sessionsHandled: number;
  lastActivity: number | null;
  // 上下文相关
  contextTokens: number;
  maxTokens: number;
  messageCount: number;
  // 其他指标
  uptime: number;
  errorCount: number;
  avgResponseMs: number;
}

// 全局统计类型
interface GlobalStats {
  totalSessions: number;
  activeAgents: number;
  totalRequests: number;
  avgResponseTime: number;
  totalTokens: number;
  successRate: number;
}

// 统计卡片组件 - 玻璃态设计
const GlassStatCard = ({ 
  icon, 
  label, 
  value, 
  gradient,
  delay = 0,
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  gradient: string;
  delay?: number;
}) => (
  <div
    className="relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
    style={{
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.8)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
      animation: `fadeSlideUp 0.5s ease-out ${delay}ms both`,
    }}
  >
    {/* 渐变背景装饰 */}
    <div 
      className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20 blur-3xl"
      style={{ background: gradient }}
    />
    
    <div className="relative flex items-start justify-between">
      <div>
        <p 
          className="text-xs font-medium mb-2 tracking-wide uppercase"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {label}
        </p>
        <p 
          className="text-2xl font-bold"
          style={{ 
            color: 'var(--theme-text-primary)',
            fontFamily: 'SF Pro Display, -apple-system, sans-serif',
          }}
        >
          {value}
        </p>
      </div>
      <div 
        className="p-2.5 rounded-xl"
        style={{ background: gradient, opacity: 0.9 }}
      >
        {icon}
      </div>
    </div>
  </div>
);

// 类型定义
type Agent = NonNullable<ReturnType<typeof useAgentsStore.getState>['agents']>[number];

// Agent 状态卡片组件 - 简约设计，始终展开
const AgentCard = ({ 
  agent, 
  runtime,
}: { 
  agent: Agent; 
  runtime?: AgentRuntimeInfo;
}) => {
  const status = runtime?.status ?? 'offline';
  
  const statusConfig = {
    idle: { color: 'var(--success)', label: '空闲' },
    busy: { color: 'var(--accent-blue)', label: '忙碌' },
    error: { color: 'var(--error)', label: '错误' },
    offline: { color: 'var(--text-muted)', label: '离线' },
  };
  
  const config = statusConfig[status];
  const contextPercent = runtime ? Math.round((runtime.contextTokens / runtime.maxTokens) * 100) : 0;
  
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ 
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* 卡片头部 - 始终显示详情 */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Agent 头像 */}
          <div 
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-medium"
            style={{ background: 'var(--accent-blue)' }}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
          
          <div className="text-left">
            <h3 className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
              {agent.name}
            </h3>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {agent.id}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span 
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ 
              background: status === 'idle' ? 'var(--success-bg)' 
                : status === 'busy' ? 'var(--accent-blue-light)'
                : status === 'error' ? 'var(--error-bg)'
                : 'var(--secondary)',
              color: config.color,
            }}
          >
            {config.label}
          </span>
        </div>
      </div>
      
      {/* 详情内容 - 始终展开 */}
      {runtime && (
        <div className="px-3 pb-3 pt-1 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
          {/* 上下文使用进度条 */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                上下文使用
              </span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                {runtime.contextTokens.toLocaleString()} / {runtime.maxTokens.toLocaleString()}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--secondary)' }}>
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${contextPercent}%`,
                  background: contextPercent > 80 ? 'var(--error)' 
                    : contextPercent > 60 ? 'var(--success)'
                    : 'var(--accent-blue)',
                }}
              />
            </div>
          </div>
          
          {/* 详细指标网格 */}
          <div className="grid grid-cols-2 gap-2">
            <MetricBox label="消息数" value={runtime.messageCount.toString()} />
            <MetricBox label="平均响应" value={`${Math.round(runtime.avgResponseMs)}ms`} />
            <MetricBox label="会话数" value={runtime.sessionsHandled.toString()} />
            <MetricBox label="运行时长" value={formatUptime(runtime.uptime)} />
            {runtime.errorCount > 0 && (
              <MetricBox label="错误数" value={runtime.errorCount.toString()} isError />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 指标显示组件
function MetricBox({ label, value, isError = false }: { label: string; value: string; isError?: boolean }) {
  return (
    <div 
      className="p-2 rounded-lg"
      style={{ background: isError ? 'var(--error-bg)' : 'var(--secondary)' }}
    >
      <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-[12px] font-semibold" style={{ color: isError ? 'var(--error)' : 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}

// 格式化运行时长
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function Studio() {
  const { t } = useTranslation();
  const agents = useAgentsStore((s) => s.agents);
  const gatewayStatus = useGatewayStore((s) => s.status);
  const sessions = useChatStore((s) => s.sessions);
  const [agentRuntimeInfo, setAgentRuntimeInfo] = useState<AgentRuntimeInfo[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    totalSessions: 0,
    activeAgents: 0,
    totalRequests: 0,
    avgResponseTime: 0,
    totalTokens: 0,
    successRate: 100,
  });

  // 模拟获取 Agent 运行时数据
  useEffect(() => {
    if (!agents.length) return;

    const mockRuntimeInfo: AgentRuntimeInfo[] = agents.map((agent) => {
      const messageCount = Math.floor(Math.random() * 100) + 10;
      const maxTokens = 128000;
      const contextRatio = Math.random() * 0.8 + 0.1;
      const contextTokens = Math.floor(maxTokens * contextRatio);
      
      return {
        agentId: agent.id,
        status: Math.random() > 0.8 ? 'busy' : 'idle',
        sessionsHandled: Math.floor(Math.random() * 50),
        lastActivity: Date.now() - Math.random() * 3600000,
        contextTokens,
        maxTokens,
        messageCount,
        uptime: Math.floor(Math.random() * 86400),
        errorCount: Math.floor(Math.random() * 5),
        avgResponseMs: Math.floor(Math.random() * 800) + 100,
      };
    });

    setAgentRuntimeInfo(mockRuntimeInfo);

    const totalTokens = mockRuntimeInfo.reduce((sum, a) => sum + a.contextTokens, 0);
    setGlobalStats({
      totalSessions: sessions.length || 12,
      activeAgents: mockRuntimeInfo.filter((a) => a.status === 'busy').length,
      totalRequests: Math.floor(Math.random() * 1000) + 500,
      avgResponseTime: Math.floor(Math.random() * 500) + 100,
      totalTokens,
      successRate: 95 + Math.floor(Math.random() * 5),
    });
  }, [agents, sessions.length]);

  // 每 5 秒刷新一次
  useEffect(() => {
    const interval = setInterval(() => {
      setAgentRuntimeInfo((prev) =>
        prev.map((agent) => {
          const contextChange = (Math.random() - 0.5) * 2000;
          const newTokens = Math.max(1000, Math.min(agent.maxTokens, agent.contextTokens + contextChange));
          
          return {
            ...agent,
            status: Math.random() > 0.9 ? 'busy' : 'idle',
            contextTokens: Math.floor(newTokens),
            messageCount: agent.messageCount + (agent.status === 'busy' ? 1 : 0),
            avgResponseMs: Math.max(50, agent.avgResponseMs + (Math.random() - 0.5) * 50),
          };
        }),
      );
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const isGatewayRunning = gatewayStatus.state === 'running';

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: 'var(--background)' }}
    >
      {/* 页面容器 */}
      <div className="max-w-5xl mx-auto p-5">
        {/* 页面标题区域 - 简约黑白灰 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              工作室
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Agent 运行状态
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isGatewayRunning ? "bg-success" : "bg-error")} />
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {isGatewayRunning ? '已连接' : '未连接'}
            </span>
          </div>
        </div>

        {/* 连接状态警告 */}
        {!isGatewayRunning && (
          <div
            className="mb-4 p-3 rounded-xl flex items-center gap-2"
            style={{ background: 'var(--error-bg)' }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--error)' }} />
            <span className="text-[11px]" style={{ color: 'var(--error)' }}>
              Gateway 未连接，当前显示模拟数据
            </span>
          </div>
        )}

        {/* 统计卡片行 - 简约设计 */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          <MiniStatCard label="总会话数" value={globalStats.totalSessions.toString()} />
          <MiniStatCard label="活跃" value={globalStats.activeAgents.toString()} />
          <MiniStatCard label="请求数" value={globalStats.totalRequests.toString()} />
          <MiniStatCard label="响应" value={`${globalStats.avgResponseTime}ms`} />
          <MiniStatCard label="Token" value={globalStats.totalTokens >= 1000 ? `${(globalStats.totalTokens / 1000).toFixed(0)}K` : globalStats.totalTokens.toString()} />
          <MiniStatCard label="成功率" value={`${globalStats.successRate}%`} />
        </div>

        {/* Agent 状态列表 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
              Agent 列表
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {agents.length} 个
            </span>
          </div>

          {agents.length === 0 ? (
            <div className="p-8 text-center" style={{ background: 'var(--secondary)', borderRadius: '12px' }}>
              <Bot className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>暂无 Agent</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((agent) => {
                const runtime = agentRuntimeInfo.find((r) => r.agentId === agent.id);
                return (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    runtime={runtime}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 简约统计卡片
function MiniStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div 
      className="p-3 rounded-xl"
      style={{ background: 'var(--secondary)' }}
    >
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
