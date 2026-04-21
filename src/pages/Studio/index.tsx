/**
 * MClaw Studio - 档案室
 * 展示所有 Agent 的真实数据，以名片形式呈现
 * 支持招聘新 Agent、模型更换、上下文压缩等操作
 */
import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, AlertCircle, MessageSquare, Activity, RefreshCw, Zap, Settings, Plus, Trash2, X, Sparkles, Minimize2, Image, Cog, FolderOpen, Users, Search, CheckSquare, Square, Edit3 } from 'lucide-react';
import { useAgentsStore } from '@/stores/agents';
import { useGatewayStore } from '@/stores/gateway';
import { useChatStore } from '@/stores/chat';
import { useProviderStore } from '@/stores/providers';
import { hostApiFetch } from '@/lib/host-api';
import { invokeIpc } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// 预设头像列表 - 高级人像系列
import avatar01 from '@/assets/avatars/avatar-01.png';
import avatar02 from '@/assets/avatars/avatar-02.png';
import avatar03 from '@/assets/avatars/avatar-03.png';
import avatar04 from '@/assets/avatars/avatar-04.png';
import avatar05 from '@/assets/avatars/avatar-05.png';
import avatar06 from '@/assets/avatars/avatar-06.png';
import avatar07 from '@/assets/avatars/avatar-07.png';
import avatar08 from '@/assets/avatars/avatar-08.png';

const PRESET_AVATARS = [
  { id: 'avatar-01', src: avatar01, name: '优雅绅士' },
  { id: 'avatar-02', src: avatar02, name: '知性女士' },
  { id: 'avatar-03', src: avatar03, name: '酷感型男' },
  { id: 'avatar-04', src: avatar04, name: '神秘佳人' },
  { id: 'avatar-05', src: avatar05, name: '赛博先锋' },
  { id: 'avatar-06', src: avatar06, name: '金色眼眸' },
  { id: 'avatar-07', src: avatar07, name: '霓虹魅影' },
  { id: 'avatar-08', src: avatar08, name: '翡翠之眸' },
];

// Agent 类型
type Agent = NonNullable<ReturnType<typeof useAgentsStore.getState>['agents']>[number];

// 状态配置 - 黑白灰
const statusConfig = {
  active: { color: '#22c55e', label: '活跃', bg: 'rgba(34, 197, 94, 0.12)' },
  idle: { color: '#6b7280', label: '空闲', bg: 'rgba(107, 114, 128, 0.12)' },
  error: { color: '#ef4444', label: '错误', bg: 'rgba(239, 68, 68, 0.12)' },
  offline: { color: '#9ca3af', label: '离线', bg: 'rgba(156, 163, 175, 0.12)' },
};

// 团队类型定义
interface Team {
  id: string;
  name: string;
  agentIds: string[];
  color: string;
  createdAt: number;
}

// 模拟任务统计
interface TaskStats {
  completed: number;
  successRate: number;
  currentTask?: string;
}

// 获取会话消息数
async function getSessionMessageCount(sessionKey: string): Promise<number> {
  try {
    const agentId = sessionKey.split(':')[1];
    const sessionId = sessionKey.split(':')[2];
    if (!agentId || !sessionId) return 0;
    
    const response = await hostApiFetch<{ success: boolean; messages?: unknown[] }>(
      `/api/sessions/transcript?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessionId)}`
    );
    return response.messages?.length || 0;
  } catch {
    return 0;
  }
}

// 真实上下文使用情况
interface ContextUsage {
  messageCount: number;
  totalChars: number;
  totalTokens: number;
  contextLimit: number;
  usedPercent: number;
}

async function getSessionContextUsage(sessionKey: string): Promise<ContextUsage | null> {
  try {
    const agentId = sessionKey.split(':')[1];
    const sessionId = sessionKey.split(':')[2];
    if (!agentId || !sessionId) return null;
    
    const response = await hostApiFetch<{ 
      success: boolean; 
      messageCount: number;
      totalChars: number;
      totalTokens: number;
      contextLimit: number;
      usedPercent: number;
    }>(
      `/api/sessions/context?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessionId)}`
    );
    
    if (response.success) {
      return {
        messageCount: response.messageCount || 0,
        totalChars: response.totalChars || 0,
        totalTokens: response.totalTokens || 0,
        contextLimit: response.contextLimit || 128000,
        usedPercent: response.usedPercent || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// 压缩会话上下文
async function compressSessionContext(sessionKey: string, keepCount: number = 20): Promise<{ success: boolean; removedCount?: number; error?: string }> {
  try {
    const response = await hostApiFetch<{ success: boolean; removedCount?: number; error?: string }>(
      '/api/sessions/compress',
      {
        method: 'POST',
        body: JSON.stringify({ sessionKey, keepCount }),
      }
    );
    return response;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// 招聘对话框组件
function RecruitDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, options: { inheritWorkspace: boolean }) => Promise<void>;
}) {
  const { t } = useTranslation('agents');
  const [name, setName] = useState('');
  const [inheritWorkspace, setInheritWorkspace] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim(), { inheritWorkspace });
      toast.success(`${name} 已加入档案室`);
      onClose();
    } catch (error) {
      toast.error(t('toast.agentCreateFailed', { error: String(error) }));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 100%)' }}>
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg" style={{ color: '#6b7280' }}>
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold" style={{ background: '#000' }}>
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#111827' }}>招聘新成员</h2>
              <p className="text-[11px]" style={{ color: '#6b7280' }}>加入档案室，开启 AI 协作之旅</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-medium" style={{ color: '#6b7280' }}>成员名称</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="给新成员起个名字..."
              className="w-full px-4 py-2.5 rounded-xl text-[13px] outline-none"
              style={{ background: '#f9fafb', border: '1px solid rgba(0,0,0,0.1)', color: '#111827' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { void handleSubmit(); } }}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: '#f3f4f6' }}>
            <div>
              <p className="text-[12px] font-medium" style={{ color: '#111827' }}>继承工作空间</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#6b7280' }}>复制现有配置和技能</p>
            </div>
            <button
              onClick={() => setInheritWorkspace(!inheritWorkspace)}
              className={cn('w-10 h-6 rounded-full relative', inheritWorkspace ? 'bg-black' : 'bg-gray-300 dark:bg-gray-600')}
            >
              <div className={cn('w-4 h-4 rounded-full absolute top-1 bg-white shadow', inheritWorkspace ? 'left-5' : 'left-1')} />
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 h-10 rounded-xl text-[12px] font-medium" style={{ background: '#f3f4f6', border: '1px solid rgba(0,0,0,0.08)', color: '#6b7280' }}>取消</button>
            <button
              onClick={() => void handleSubmit()}
              disabled={saving || !name.trim()}
              className="flex-1 h-10 rounded-xl text-[12px] font-medium flex items-center justify-center gap-2"
              style={{ background: name.trim() ? '#000' : '#f3f4f6', color: name.trim() ? '#fff' : '#9ca3af' }}
            >
              {saving ? (<><RefreshCw className="w-3.5 h-3.5" />招聘中...</>) : (<><Plus className="w-3.5 h-3.5" />确认招聘</>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 删除确认对话框
function DeleteConfirmDialog({ agentName, onConfirm, onCancel }: { agentName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="w-full max-w-xs rounded-2xl p-6" style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }} onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <Trash2 className="w-5 h-5" style={{ color: '#ef4444' }} />
          </div>
          <h3 className="text-[14px] font-medium" style={{ color: '#111827' }}>确认移除</h3>
          <p className="text-[11px] mt-1" style={{ color: '#6b7280' }}>移除 "{agentName}"？此操作无法撤销</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 h-9 rounded-lg text-[11px] font-medium" style={{ background: '#f3f4f6', color: '#6b7280' }}>取消</button>
          <button onClick={onConfirm} className="flex-1 h-9 rounded-lg text-[11px] font-medium bg-red-500 text-white">确认移除</button>
        </div>
      </div>
    </div>
  );
}

// 模型 Logo 映射
const modelLogos: Record<string, string> = {
  'gpt': '🤖',
  'claude': '🧠',
  'gemini': '✨',
  'deepseek': '🔮',
  'qwen': '🐱',
  'yi': '💫',
  'moonshot': '🌙',
  'zhipu': '📚',
  'minimax': '🎯',
  'doubao': '🎪',
  'kimi': '🌙',
  'default': '🔗',
};

function getModelLogo(modelName: string): string {
  const lower = modelName.toLowerCase();
  for (const [key, logo] of Object.entries(modelLogos)) {
    if (lower.includes(key)) return logo;
  }
  return modelLogos.default;
}

// Agent 名片卡片组件 - 紧凑横向布局
const AgentProfileCard = memo(({
  agent, sessionsCount, totalMessages, channels, navigate,
  onDelete, onCompressContext, onChangeAvatar, onChangeModel, compressing,
  contextUsage, taskStats,
}: {
  agent: Agent;
  sessionsCount: number;
  totalMessages: number;
  channels: string[];
  navigate: ReturnType<typeof useNavigate>;
  onDelete: () => void;
  onCompressContext: () => void;
  onChangeAvatar: () => void;
  onChangeModel: () => void;
  compressing: boolean;
  contextUsage?: ContextUsage | null;
  taskStats?: TaskStats;
}) => {
  const [collapsed, _setCollapsed] = useState(false);
  const providerAccounts = useProviderStore((s) => s.accounts);
  const providerAccount = providerAccounts.find((p) => p.id === agent.providerAccountId);
  const providerName = providerAccount?.vendorId || '未配置';
  const modelName = agent.modelRef?.split('/')[1] || '未设置';
  const status = sessionsCount > 0 ? 'active' : 'idle';
  const config = statusConfig[status];
  const usedPercent = contextUsage?.usedPercent || 0;
  const totalTokens = contextUsage?.totalTokens || 0;

  // 获取当前头像
  const avatarId = (agent as any).avatarId || '';
  const isCustomAvatar = avatarId.startsWith('custom:');
  const customAvatarUrl = isCustomAvatar ? avatarId.replace('custom:', '') : null;
  const presetAvatar = PRESET_AVATARS.find(a => a.id === avatarId);
  const currentAvatar = presetAvatar || (isCustomAvatar && customAvatarUrl ? { id: 'custom', src: customAvatarUrl, name: '自定义头像' } : PRESET_AVATARS[0]);

  // 打开工作区文件夹
  const openWorkspace = async () => {
    try {
      const response = await hostApiFetch<any>(
        `/api/config/agent/${encodeURIComponent(agent.id)}/workspace`
      );
      
      console.log('[Studio] API 完整响应:', JSON.stringify(response, null, 2));
      
      if (!response) {
        alert('获取工作区路径失败');
        return;
      }
      
      // 支持多种响应格式
      const expandedPath = response.expandedPath || response.path || null;
      
      if (!expandedPath) {
        alert(`工作区路径为空。API 返回: ${JSON.stringify(response)}`);
        return;
      }
      
      if (!response.exists) {
        alert(`工作区目录不存在: ${response.path}`);
        return;
      }
      
      console.log('[Studio] 打开文件夹:', expandedPath);
      await invokeIpc('shell:showItemInFolder', expandedPath);
    } catch (err) {
      console.error('[Studio] 打开工作区失败:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`打开工作区失败: ${message}`);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0, 0, 0, 0.08)', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)' }}>
      {/* 主内容区 - 横向布局 */}
      <div className="flex">
        {/* 头像 - 左侧 */}
        <button 
          onClick={onChangeAvatar}
          className="w-20 h-20 shrink-0 rounded-br-2xl rounded-tl-2xl overflow-hidden shadow-lg relative group cursor-pointer"
          title="点击更换头像"
        >
          {currentAvatar ? (
            <img src={currentAvatar.src} alt={currentAvatar.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold" style={{ background: '#000' }}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center">
            <Image className="w-6 h-6 text-white" />
          </div>
        </button>

        {/* 中间信息区 - 名字和简介占主导 */}
        <div className="flex-1 px-3 py-2 min-w-0">
          {/* 名字 + 简介 */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{agent.name}</h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium shrink-0" style={{ background: config.bg, color: config.color }}>
                {config.label}
              </span>
            </div>
            {agent.description && (
              <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                {agent.description}
              </p>
            )}
          </div>

          {/* 统计数据 - 紧凑横向 */}
          {!collapsed && (
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              <span style={{ color: 'var(--text-muted)' }}>📊 {sessionsCount}会话</span>
              <span style={{ color: 'var(--text-muted)' }}>📢 {channels.length}渠道</span>
              {contextUsage && (
                <span style={{ color: usedPercent > 80 ? '#ef4444' : usedPercent > 50 ? '#f59e0b' : '#22c55e' }}>
                  📈 {usedPercent}%
                </span>
              )}
              {taskStats && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>✅ {taskStats.completed}任务</span>
                  <span style={{ color: taskStats.successRate >= 90 ? '#22c55e' : taskStats.successRate >= 70 ? '#f59e0b' : '#ef4444' }}>
                    🎯 {taskStats.successRate}%
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* 右侧操作按钮 - 垂直排列 */}
        <div className="flex flex-col items-center gap-1 px-2 py-2">
          <button onClick={openWorkspace} className="p-1.5 rounded-lg" style={{ color: 'var(--accent-blue)' }} title="打开工作区文件夹">
            <FolderOpen className="w-4 h-4" />
          </button>
          <button onClick={() => navigate('/config')} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} title="属性配置">
            <Cog className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg" style={{ color: '#ef4444' }} title="删除成员">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 折叠区域 - 模型更换 + 上下文压缩 */}
      {!collapsed && (
        <div className="px-3 pb-2">
          {/* 模型更换按钮 - 可点击 */}
          <button
            onClick={onChangeModel}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg mb-2"
            style={{ background: 'rgba(0, 0, 0, 0.04)' }}
          >
            <span className="text-base">{getModelLogo(modelName)}</span>
            <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{modelName}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{providerName}</span>
            <span className="text-[10px] ml-auto" style={{ color: 'var(--text-muted)' }}>模型更换 ▼</span>
          </button>

          {/* 上下文压缩 */}
          <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
            <Minimize2 className="w-3 h-3 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>上下文</span>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {contextUsage ? `${(totalTokens / 1000).toFixed(1)}K tokens` : `${totalMessages}条消息`}
                </span>
              </div>
              {contextUsage && (
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.08)' }}>
                  <div className="h-full rounded-full" style={{ width: `${usedPercent}%`, background: usedPercent > 80 ? '#ef4444' : usedPercent > 50 ? '#f59e0b' : '#22c55e' }} />
                </div>
              )}
            </div>
            <button
              onClick={onCompressContext}
              disabled={compressing || sessionsCount === 0}
              className="px-2 py-1 rounded text-[9px] font-medium shrink-0"
              style={{ background: sessionsCount === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(239,68,68,0.1)', color: sessionsCount === 0 ? 'var(--text-muted)' : '#ef4444' }}
            >
              {compressing ? '压缩中...' : '压缩'}
            </button>
          </div>
          {channels.length > 0 && (
            <p className="text-[9px] mt-1.5 px-1" style={{ color: 'var(--text-muted)' }}>已连接: {channels.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
});

// 头像选择对话框 - 支持预设和自定义上传
function AvatarSelectorDialog({
  agent,
  currentAvatarId,
  onClose,
  onSelect,
}: {
  agent: Agent;
  currentAvatarId?: string;
  onClose: () => void;
  onSelect: (avatarId: string) => void;
}) {
  const [selected, setSelected] = useState(currentAvatarId || PRESET_AVATARS[0].id);
  const [customPreview, setCustomPreview] = useState<string | null>(
    currentAvatarId?.startsWith('custom:') ? currentAvatarId.replace('custom:', '') : null
  );
  const [isCustomSelected, setIsCustomSelected] = useState(currentAvatarId?.startsWith('custom:') || false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }
    
    // 验证文件大小（最大 500KB）
    if (file.size > 500 * 1024) {
      toast.error('图片大小不能超过 500KB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCustomPreview(dataUrl);
      setIsCustomSelected(true);
      setSelected('custom');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustom = () => {
    setCustomPreview(null);
    setIsCustomSelected(false);
    setSelected(PRESET_AVATARS[0].id);
  };

  const handleApply = () => {
    if (isCustomSelected && customPreview) {
      onSelect(`custom:${customPreview}`);
    } else if (selected && selected !== currentAvatarId) {
      onSelect(selected);
    }
    onClose();
  };

  const isSelected = (id: string) => !isCustomSelected && selected === id;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ 
          background: '#ffffff', 
          border: '1px solid rgba(0,0,0,0.1)', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="relative px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 100%)' }}>
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg" style={{ color: '#6b7280' }}>
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#000' }}>
              <Image className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#111827' }}>更换头像</h2>
              <p className="text-[11px]" style={{ color: '#6b7280' }}>为 {agent.name} 选择一个新头像</p>
            </div>
          </div>
        </div>

        {/* 头像网格 */}
        <div className="p-6">
          <p className="text-[11px] font-medium mb-3" style={{ color: '#6b7280' }}>预设头像</p>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {PRESET_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => { setSelected(avatar.id); setIsCustomSelected(false); }}
                className={cn(
                  'relative w-full aspect-square rounded-xl overflow-hidden',
                  isSelected(avatar.id) ? 'ring-2 ring-offset-2' : ''
                )}
                style={{ 
                  background: isSelected(avatar.id) ? 'rgba(0,0,0,0.05)' : 'transparent'
                }}
                title={avatar.name}
              >
                <img src={avatar.src} alt={avatar.name} className="w-full h-full object-cover" />
                {isSelected(avatar.id) && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-black" />
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
          
          {/* 自定义上传区域 */}
          <p className="text-[11px] font-medium mb-3" style={{ color: '#6b7280' }}>自定义头像</p>
          <div className="grid grid-cols-5 gap-3">
            {/* 自定义头像预览 */}
            <div
              className={cn(
                'relative w-full aspect-square rounded-xl overflow-hidden cursor-pointer',
                isCustomSelected 
                  ? 'ring-2 ring-offset-2 scale-105' 
                  : 'hover:scale-105 hover:shadow-md'
              )}
              style={{ 
                background: '#f3f4f6'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {customPreview ? (
                <>
                  <img src={customPreview} alt="自定义头像" className="w-full h-full object-cover" />
                  {isCustomSelected && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-black" />
                      </div>
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveCustom(); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                    title="移除"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <Plus className="w-6 h-6" style={{ color: '#9ca3af' }} />
                  <span className="text-[9px] mt-1" style={{ color: '#9ca3af' }}>上传</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <p className="text-[10px] mt-2" style={{ color: '#9ca3af' }}>支持 JPG、PNG、GIF，建议尺寸 200x200，最大 500KB</p>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 pb-6 flex gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 h-10 rounded-xl text-[12px] font-medium"
            style={{ background: '#f3f4f6', border: '1px solid rgba(0,0,0,0.08)', color: '#6b7280' }}
          >
            取消
          </button>
          <button 
            onClick={handleApply}
            disabled={(isCustomSelected && customPreview ? selected === currentAvatarId?.replace('custom:', '') : selected === currentAvatarId) || (!isCustomSelected && !selected)}
            className="flex-1 h-10 rounded-xl text-[12px] font-medium flex items-center justify-center gap-2"
            style={{ 
              background: (isCustomSelected ? true : selected !== currentAvatarId) ? '#000' : '#f3f4f6',
              color: (isCustomSelected ? true : selected !== currentAvatarId) ? '#fff' : '#9ca3af',
              opacity: (isCustomSelected ? true : selected !== currentAvatarId) ? 1 : 0.5,
              cursor: (isCustomSelected ? true : selected !== currentAvatarId) ? 'pointer' : 'not-allowed'
            }}
          >
            应用头像
          </button>
        </div>
      </div>
    </div>
  );
}

// 模型选择对话框 - 直接读取 Provider 账户的实际配置
function ModelSelectorDialog({
  agent,
  currentModel,
  providerAccounts,
  onClose,
  onSelect,
}: {
  agent: Agent;
  currentModel: string;
  providerAccounts: { id: string; label: string; vendorId: string }[];
  onClose: () => void;
  onSelect: (providerAccountId: string, modelRef: string) => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState(agent.providerAccountId || providerAccounts[0]?.id || '');
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [customModelInput, setCustomModelInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const dialogProviderAccounts = useProviderStore((s) => s.accounts);
  const selectedProviderAccount = dialogProviderAccounts.find((p) => p.id === selectedProvider);
  
  // 直接从 Provider 账户配置读取模型列表
  const configuredModels = useMemo(() => {
    if (!selectedProviderAccount) return [];
    const models: string[] = [];
    // 主模型
    if (selectedProviderAccount.model) {
      models.push(selectedProviderAccount.model);
    }
    // 备用模型
    if (selectedProviderAccount.fallbackModels && selectedProviderAccount.fallbackModels.length > 0) {
      models.push(...selectedProviderAccount.fallbackModels);
    }
    // 去除重复
    return [...new Set(models)];
  }, [selectedProviderAccount]);

  const hasConfiguredModels = configuredModels.length > 0;

  const handleApply = async () => {
    const modelToUse = showCustomInput ? customModelInput : selectedModel;
    if (!modelToUse) return;
    setSaving(true);
    try {
      await onSelect(selectedProvider, modelToUse);
      toast.success('模型已更换');
      onClose();
    } catch {
      toast.error('模型更换失败');
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedModel('');
    setCustomModelInput('');
    setShowCustomInput(false);
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    setShowCustomInput(false);
    setCustomModelInput('');
  };

  const handleCustomToggle = () => {
    setShowCustomInput(!showCustomInput);
    if (!showCustomInput) {
      setSelectedModel('');
      setCustomModelInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ 
          background: '#ffffff', 
          border: '1px solid rgba(0,0,0,0.1)', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="relative px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 100%)' }}>
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg" style={{ color: '#6b7280' }}>
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: '#000' }}>
              <Cog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#111827' }}>模型更换</h2>
              <p className="text-[11px]" style={{ color: '#6b7280' }}>为 {agent.name} 选择模型</p>
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 提供商选择 */}
          <div className="space-y-2">
            <label className="text-[11px] font-medium" style={{ color: '#6b7280' }}>选择提供商</label>
            <div className="flex flex-wrap gap-2">
              {providerAccounts.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium"
                  style={{ 
                    background: selectedProvider === provider.id ? '#000' : '#f3f4f6',
                    color: selectedProvider === provider.id ? '#fff' : '#6b7280'
                  }}
                >
                  {provider.label}
                </button>
              ))}
            </div>
          </div>

          {/* 模型选择 - 直接使用 Provider 账户配置的模型 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium" style={{ color: '#6b7280' }}>
                选择模型
                {selectedProviderAccount && (
                  <span className="ml-1 text-[10px]" style={{ color: '#9ca3af' }}>
                    (来自 {selectedProviderAccount.label})
                  </span>
                )}
              </label>
              <button
                onClick={handleCustomToggle}
                className="text-[10px] px-2 py-0.5 rounded"
                style={{ 
                  background: showCustomInput ? '#000' : 'rgba(0,0,0,0.06)',
                  color: showCustomInput ? '#fff' : '#6b7280'
                }}
              >
                {showCustomInput ? '返回列表' : '手动输入'}
              </button>
            </div>
            
            {showCustomInput ? (
              /* 手动输入模式 */
              <div className="space-y-2">
                <input
                  type="text"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  placeholder={selectedProviderAccount?.vendorId ? `${selectedProviderAccount.vendorId}/model-id` : '输入模型 ID'}
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                  style={{ background: '#f9fafb', border: '1px solid rgba(0,0,0,0.1)', color: '#111827' }}
                />
                <p className="text-[10px]" style={{ color: '#9ca3af' }}>
                  格式: {selectedProviderAccount?.vendorId || 'provider'}/model-id
                </p>
              </div>
            ) : (
              /* 直接使用 Provider 配置的模型列表 */
              <div className="max-h-60 overflow-y-auto">
                {!hasConfiguredModels ? (
                  <div className="text-center py-8 px-4">
                    <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.06)' }}>
                      <Cog className="w-5 h-5" style={{ color: '#9ca3af' }} />
                    </div>
                    <p className="text-[12px] font-medium mb-1" style={{ color: '#6b7280' }}>暂无可用模型</p>
                    <p className="text-[10px] mb-3" style={{ color: '#9ca3af' }}>
                      请先在「AI 模型服务商」设置中配置模型
                    </p>
                    <button
                      onClick={handleCustomToggle}
                      className="text-[11px] px-3 py-1.5 rounded-lg"
                      style={{ background: '#000', color: '#fff' }}
                    >
                      手动输入模型
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1">
                    {configuredModels.map((model, index) => {
                      const isSelected = selectedModel === model;
                      const isCurrentModel = currentModel === model;
                      return (
                        <button
                          key={`${model}-${index}`}
                          onClick={() => handleModelSelect(model)}
                          className="px-3 py-2 rounded-lg text-left text-[12px] flex items-center gap-2"
                          style={{ 
                            background: isSelected ? 'rgba(0,0,0,0.08)' : 'transparent',
                            color: isSelected ? '#111827' : '#6b7280',
                            border: isSelected ? '1px solid rgba(0,0,0,0.2)' : '1px solid transparent'
                          }}
                        >
                          <span className="text-sm">{getModelLogo(model)}</span>
                          <span className="truncate flex-1 font-mono text-[11px]">{model}</span>
                          {isCurrentModel && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                              当前
                            </span>
                          )}
                          {isSelected && !isCurrentModel && (
                            <span style={{ color: '#22c55e' }}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 pb-6 flex gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 h-10 rounded-xl text-[12px] font-medium"
            style={{ background: '#f3f4f6', border: '1px solid rgba(0,0,0,0.08)', color: '#6b7280' }}
          >
            取消
          </button>
          <button 
            onClick={handleApply}
            disabled={saving || (!selectedModel && !customModelInput)}
            className="flex-1 h-10 rounded-xl text-[12px] font-medium flex items-center justify-center gap-2"
            style={{ 
              background: (selectedModel || customModelInput) ? '#000' : '#f3f4f6',
              color: (selectedModel || customModelInput) ? '#fff' : '#9ca3af',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? '保存中...' : '确认更换'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 招聘新成员卡片 - 紧凑高度
const RecruitCard = ({ onClick }: { onClick: () => void }) => (
  <button onClick={onClick} className="relative rounded-2xl overflow-hidden min-h-[120px] flex items-center justify-center" style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(20px)', border: '2px dashed rgba(0, 0, 0, 0.15)' }}>
    <div className="text-center">
      <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>
        <Plus className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>招聘新成员</p>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>加入新的 AI Agent</p>
    </div>
  </button>
);

// 全局统计卡片
const GlobalStatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="relative overflow-hidden rounded-xl p-4" style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(16px)', border: '1px solid rgba(0, 0, 0, 0.06)' }}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
      </div>
      <div className="p-2 rounded-lg" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>
        <div style={{ color: 'var(--text-secondary)' }}>{icon}</div>
      </div>
    </div>
  </div>
);

export function Studio() {
  const navigate = useNavigate();
  const agents = useAgentsStore((s) => s.agents);
  const channelOwners = useAgentsStore((s) => s.channelOwners);
  const { createAgent, deleteAgent, fetchAgents } = useAgentsStore();
  const gatewayStatus = useGatewayStore((s) => s.status);
  const chatSessions = useChatStore((s) => s.sessions);
  const providerAccounts = useProviderStore((s) => s.accounts);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showRecruitDialog, setShowRecruitDialog] = useState(false);
  const [deleteConfirmAgent, setDeleteConfirmAgent] = useState<Agent | null>(null);
  const [avatarSelectorAgent, setAvatarSelectorAgent] = useState<Agent | null>(null);
  const [modelSelectorAgent, setModelSelectorAgent] = useState<Agent | null>(null);
  const [compressingSessions, setCompressingSessions] = useState<Record<string, boolean>>({});
  const [agentMessages, setAgentMessages] = useState<Record<string, number>>({});
  const [agentContextUsage, setAgentContextUsage] = useState<Record<string, ContextUsage | null>>({});

  // 视图模式：'personal' | 'team'
  const [viewMode, setViewMode] = useState<'personal' | 'team'>('personal');
  
  // 搜索和筛选
  const [searchQuery, setSearchQuery] = useState('');
  
  // 批量操作模式
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<string[]>([]);
  
  // 团队管理
  const [teams, setTeams] = useState<Team[]>([]);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [selectedTeamAgents, setSelectedTeamAgents] = useState<string[]>([]);
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<Team | null>(null);

  const isGatewayRunning = gatewayStatus.state === 'running';

  const providerAccountsList = useMemo(() => {
    return providerAccounts.map((acc) => ({ id: acc.id, label: acc.label, vendorId: acc.vendorId }));
  }, [providerAccounts]);

  const agentStats = useMemo(() => {
    const stats: Record<string, { sessionsCount: number; sessions: { key: string; lastActivity: number }[]; channels: string[] }> = {};
    for (const agent of agents) {
      const agentSessions = chatSessions.filter((s) => s.key.startsWith(`agent:${agent.id}:`)).map((s) => ({ key: s.key, lastActivity: s.updatedAt || 0 }));
      const agentChannels = Object.entries(channelOwners).filter(([, ownerAgentId]) => ownerAgentId === agent.id).map(([channelType]) => channelType);
      stats[agent.id] = { sessionsCount: agentSessions.length, sessions: agentSessions, channels: agentChannels };
    }
    return stats;
  }, [agents, chatSessions, channelOwners, refreshKey]);

  // 性能优化：并行加载所有数据
  useEffect(() => {
    let cancelled = false;
    
    const loadMessageCounts = async () => {
      // 并行加载所有 agent 的数据
      const loadAgentData = async (agent: Agent) => {
        const stats = agentStats[agent.id];
        if (!stats || stats.sessionsCount === 0) {
          return { agentId: agent.id, total: 0, usage: null };
        }
        
        // 并行加载所有会话数据
        const sessionPromises = stats.sessions.map(async (session) => {
          const [count, usage] = await Promise.all([
            getSessionMessageCount(session.key),
            getSessionContextUsage(session.key),
          ]);
          return { count, usage };
        });
        
        const sessionResults = await Promise.all(sessionPromises);
        
        let total = 0;
        let totalTokens = 0;
        let totalChars = 0;
        let contextLimit = 128000;
        let maxUsedPercent = 0;
        
        for (const { count, usage } of sessionResults) {
          total += count;
          if (usage) {
            totalTokens += usage.totalTokens;
            totalChars += usage.totalChars;
            if (usage.usedPercent > maxUsedPercent) {
              maxUsedPercent = usage.usedPercent;
              contextLimit = usage.contextLimit;
            }
          }
        }
        
        return {
          agentId: agent.id,
          total,
          usage: { messageCount: total, totalChars, totalTokens, contextLimit, usedPercent: maxUsedPercent },
        };
      };
      
      // 并行处理所有 agent
      const results = await Promise.all(agents.map(loadAgentData));
      
      if (cancelled) return;
      
      const counts: Record<string, number> = {};
      const contextUsages: Record<string, ContextUsage | null> = {};
      
      for (const result of results) {
        counts[result.agentId] = result.total;
        contextUsages[result.agentId] = result.usage;
      }
      
      setAgentMessages(counts);
      setAgentContextUsage(contextUsages);
    };
    
    if (agents.length > 0) { void loadMessageCounts(); }
    
    return () => { cancelled = true; };
  }, [agents, agentStats, refreshKey]);

  const globalStats = useMemo(() => {
    const activeAgents = Object.values(agentStats).filter((s) => s.sessionsCount > 0).length;
    const totalChannels = new Set(Object.values(agentStats).flatMap((s) => s.channels)).size;
    return { totalAgents: agents.length, activeAgents, totalSessions: chatSessions.length, totalChannels, totalMessages: Object.values(agentMessages).reduce((a, b) => a + b, 0) };
  }, [agents.length, agentStats, chatSessions.length, agentMessages]);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    void fetchAgents();
    void useChatStore.getState().loadSessions();
  }, [fetchAgents]);

  useEffect(() => {
    const interval = setInterval(() => { void useChatStore.getState().loadSessions(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateAgent = async (name: string, options: { inheritWorkspace: boolean }) => {
    await createAgent(name, options);
    await fetchAgents();
    setRefreshKey((k) => k + 1);
  };

  // 更新 Agent 头像
  const handleUpdateAvatar = async (agentId: string, avatarId: string) => {
    try {
      await hostApiFetch(`/api/agents/${encodeURIComponent(agentId)}/avatar`, {
        method: 'PUT',
        body: JSON.stringify({ avatarId }),
      });
      toast.success('头像已更新');
      await fetchAgents();
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error('头像更新失败');
    }
  };

  // 更换 Agent 模型
  const handleUpdateModel = async (agentId: string, providerAccountId: string, modelRef: string) => {
    try {
      await hostApiFetch(`/api/agents/${encodeURIComponent(agentId)}`, {
        method: 'PUT',
        body: JSON.stringify({ providerAccountId, modelRef }),
      });
      toast.success('模型已更换');
      await fetchAgents();
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error('模型更换失败');
    }
  };

  const handleDeleteAgent = async () => {
    if (!deleteConfirmAgent) return;
    try {
      await deleteAgent(deleteConfirmAgent.id);
      toast.success(`${deleteConfirmAgent.name} 已移除`);
      await fetchAgents();
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error('删除失败');
    } finally {
      setDeleteConfirmAgent(null);
    }
  };

  const handleCompressContext = async (agent: Agent) => {
    const stats = agentStats[agent.id];
    if (!stats || stats.sessionsCount === 0) { toast.error('该 Agent 没有会话'); return; }
    setCompressingSessions((prev) => ({ ...prev, [agent.id]: true }));
    try {
      let totalRemoved = 0;
      for (const session of stats.sessions) {
        const result = await compressSessionContext(session.key, 20);
        if (result.success && result.removedCount) { totalRemoved += result.removedCount; }
      }
      if (totalRemoved > 0) {
        toast.success(`已压缩 ${totalRemoved} 条历史消息`);
        const count = await getSessionMessageCount(stats.sessions[0].key);
        setAgentMessages((prev) => ({ ...prev, [agent.id]: count }));
      } else {
        toast.info('无需压缩的会话');
      }
    } catch {
      toast.error('压缩失败');
    } finally {
      setCompressingSessions((prev) => ({ ...prev, [agent.id]: false }));
    }
  };

  // ========== 团队管理功能 ==========
  
  // 创建或编辑团队
  const handleSaveTeam = () => {
    if (!teamNameInput.trim() || selectedTeamAgents.length === 0) {
      toast.error('请输入团队名称并选择至少一个 Agent');
      return;
    }
    
    if (editingTeam) {
      // 编辑现有团队
      setTeams(prev => prev.map(t => 
        t.id === editingTeam.id 
          ? { ...t, name: teamNameInput.trim(), agentIds: selectedTeamAgents }
          : t
      ));
      toast.success('团队已更新');
    } else {
      // 创建新团队
      const newTeam: Team = {
        id: `team-${Date.now()}`,
        name: teamNameInput.trim(),
        agentIds: selectedTeamAgents,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        createdAt: Date.now(),
      };
      setTeams(prev => [...prev, newTeam]);
      toast.success('团队创建成功');
    }
    
    setShowTeamDialog(false);
    setTeamNameInput('');
    setSelectedTeamAgents([]);
    setEditingTeam(null);
  };

  // 删除团队
  const handleDeleteTeam = () => {
    if (!deleteConfirmTeam) return;
    setTeams(prev => prev.filter(t => t.id !== deleteConfirmTeam.id));
    toast.success(`团队 "${deleteConfirmTeam.name}" 已删除`);
    setDeleteConfirmTeam(null);
  };

  // 打开创建团队对话框
  const openCreateTeamDialog = () => {
    setEditingTeam(null);
    setTeamNameInput('');
    setSelectedTeamAgents(batchSelected.length > 0 ? batchSelected : []);
    setShowTeamDialog(true);
    setBatchMode(false);
  };

  // 打开编辑团队对话框
  const openEditTeamDialog = (team: Team) => {
    setEditingTeam(team);
    setTeamNameInput(team.name);
    setSelectedTeamAgents(team.agentIds);
    setShowTeamDialog(true);
  };

  // ========== 批量操作功能 ==========
  
  // 切换批量选择
  const toggleBatchSelection = (agentId: string) => {
    setBatchSelected(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (batchSelected.length === filteredAgents.length) {
      setBatchSelected([]);
    } else {
      setBatchSelected(filteredAgents.map(a => a.id));
    }
  };

  // 批量分配任务（模拟）
  const batchAssignTasks = () => {
    toast.success(`已为 ${batchSelected.length} 个 Agent 分配任务`);
    setBatchSelected([]);
    setBatchMode(false);
  };

  // 从批量选择创建团队
  const createTeamFromBatch = () => {
    if (batchSelected.length === 0) return;
    openCreateTeamDialog();
  };

  // 获取模拟任务统计
  const getTaskStats = (agentId: string): TaskStats => {
    // 基于 agentId 生成稳定的随机数据
    const seed = agentId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return {
      completed: (seed % 50) + 5,
      successRate: 85 + (seed % 15),
    };
  };

  // 筛选 Agent
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter(agent => 
      agent.name.toLowerCase().includes(query) ||
      (agent.description && agent.description.toLowerCase().includes(query))
    );
  }, [agents, searchQuery]);

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto p-6">
        <PageHeader
          title={<><span style={{ fontFamily: 'Georgia, serif' }}>Agents</span> 档案室</>}
          description={viewMode === 'personal' ? `Agent 个人档案 · ${agents.length} 个成员` : `团队管理 · ${teams.length} 个团队`}
          actions={
            <div className="flex items-center gap-3">
              {/* 视图切换 */}
              <div className="flex items-center rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.04)' }}>
                <button 
                  onClick={() => setViewMode('personal')}
                  className={cn("px-3 py-1.5 rounded-md text-[11px] font-medium transition-all", viewMode === 'personal' ? 'bg-white shadow-sm' : '')}
                  style={{ color: viewMode === 'personal' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  个人
                </button>
                <button 
                  onClick={() => setViewMode('team')}
                  className={cn("px-3 py-1.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1", viewMode === 'team' ? 'bg-white shadow-sm' : '')}
                  style={{ color: viewMode === 'team' ? 'var(--text-primary)' : 'var(--text-muted)' }}
                >
                  <Users className="w-3 h-3" />
                  团队
                </button>
              </div>
              <button onClick={handleRefresh} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }} title="刷新数据"><RefreshCw className="w-4 h-4" /></button>
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", isGatewayRunning ? "bg-green-500" : "bg-gray-400")} />
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{isGatewayRunning ? '已连接' : '未连接'}</span>
              </div>
            </div>
          }
        />

        {!isGatewayRunning && (
          <div className="mb-5 p-3 rounded-xl flex items-center gap-2" style={{ background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.08)' }}>
            <AlertCircle className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>Gateway 未连接，显示最近同步的数据</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {viewMode === 'personal' ? (
            <>
              <GlobalStatCard icon={<Bot className="w-5 h-5" />} label="Agent 总数" value={globalStats.totalAgents.toString()} />
              <GlobalStatCard icon={<Activity className="w-5 h-5" />} label="活跃 Agent" value={globalStats.activeAgents.toString()} />
              <GlobalStatCard icon={<MessageSquare className="w-5 h-5" />} label="总会话数" value={globalStats.totalSessions.toString()} />
              <GlobalStatCard icon={<Zap className="w-5 h-5" />} label="总消息数" value={globalStats.totalMessages.toString()} />
              <GlobalStatCard icon={<Settings className="w-5 h-5" />} label="已配置渠道" value={globalStats.totalChannels.toString()} />
            </>
          ) : (
            <>
              <GlobalStatCard icon={<Users className="w-5 h-5" />} label="团队总数" value={teams.length.toString()} />
              <GlobalStatCard icon={<Bot className="w-5 h-5" />} label="Agent 总数" value={globalStats.totalAgents.toString()} />
              <GlobalStatCard icon={<Activity className="w-5 h-5" />} label="活跃 Agent" value={globalStats.activeAgents.toString()} />
              <GlobalStatCard icon={<MessageSquare className="w-5 h-5" />} label="总会话数" value={globalStats.totalSessions.toString()} />
              <GlobalStatCard icon={<Zap className="w-5 h-5" />} label="总消息数" value={globalStats.totalMessages.toString()} />
            </>
          )}
        </div>

        {/* 搜索栏和批量操作 - 仅在个人视图显示 */}
        {viewMode === 'personal' && (
          <div className="mb-4 space-y-3">
            {/* 搜索栏 */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="搜索 Agent 名称或描述..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.1)', color: 'var(--text-muted)' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <button 
                onClick={() => { setBatchMode(!batchMode); setBatchSelected([]); }}
                className={cn("px-4 py-2.5 rounded-xl text-[12px] font-medium flex items-center gap-2 transition-all", batchMode ? 'bg-black text-white' : 'bg-white/60')}
                style={{ border: '1px solid rgba(0,0,0,0.08)' }}
              >
                {batchMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {batchMode ? '完成' : '批量'}
              </button>
            </div>

            {/* 批量操作栏 */}
            {batchMode && (
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={toggleSelectAll}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}
                  >
                    {batchSelected.length === filteredAgents.length ? '取消全选' : '全选'}
                  </button>
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                    已选择 <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{batchSelected.length}</span> 个 Agent
                  </span>
                </div>
                {batchSelected.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={batchAssignTasks}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-black text-white"
                    >
                      分配任务
                    </button>
                    <button 
                      onClick={createTeamFromBatch}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-medium"
                      style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--text-secondary)' }}
                    >
                      组建团队
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 团队视图 - 创建团队按钮 */}
        {viewMode === 'team' && (
          <div className="mb-4">
            <button 
              onClick={openCreateTeamDialog}
              className="w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all hover:bg-black/5"
              style={{ borderColor: 'rgba(0,0,0,0.15)', color: 'var(--text-muted)' }}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[13px] font-medium">创建新团队</span>
            </button>
          </div>
        )}

        {/* Agent 卡片网格 + 招聘卡片（最后） */}
        {viewMode === 'personal' ? (
          <>
            {/* 空状态 */}
            {filteredAgents.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <Search className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>未找到匹配的 Agent</p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>尝试使用其他关键词搜索</p>
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mt-4 px-4 py-2 rounded-lg text-[12px] font-medium bg-black text-white"
                >
                  清除搜索
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredAgents.map((agent) => {
                const stats = agentStats[agent.id] || { sessionsCount: 0, sessions: [], channels: [] };
                const taskStats = getTaskStats(agent.id);
                const isBatchSelected = batchSelected.includes(agent.id);
                
                return (
                  <div 
                    key={agent.id}
                    className={cn(
                      "relative rounded-2xl overflow-hidden transition-all",
                      batchMode && "cursor-pointer",
                      batchMode && isBatchSelected && "ring-2 ring-black"
                    )}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.6)', 
                      backdropFilter: 'blur(20px)', 
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
                    }}
                    onClick={() => batchMode && toggleBatchSelection(agent.id)}
                  >
                    {/* 批量选择指示器 */}
                    {batchMode && (
                      <div className={cn(
                        "absolute top-3 left-3 z-10 w-5 h-5 rounded-md flex items-center justify-center transition-all",
                        isBatchSelected ? "bg-black text-white" : "bg-white/80 border border-black/20"
                      )}>
                        {isBatchSelected && <CheckSquare className="w-3.5 h-3.5" />}
                      </div>
                    )}
                    
                    <AgentProfileCard
                      agent={agent}
                      sessionsCount={stats.sessionsCount}
                      totalMessages={agentMessages[agent.id] || 0}
                      channels={stats.channels}
                      navigate={navigate}
                      onDelete={() => setDeleteConfirmAgent(agent)}
                      onCompressContext={() => handleCompressContext(agent)}
                      onChangeAvatar={() => setAvatarSelectorAgent(agent)}
                      onChangeModel={() => setModelSelectorAgent(agent)}
                      compressing={compressingSessions[agent.id] || false}
                      contextUsage={agentContextUsage[agent.id]}
                      taskStats={taskStats}
                    />
                  </div>
                );
              })}
              {!batchMode && <RecruitCard onClick={() => setShowRecruitDialog(true)} />}
            </div>
          </>
        ) : (
          /* 团队视图 */
          <div className="space-y-4">
            {teams.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.04)' }}>
                  <Users className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>暂无团队</p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>创建团队来更好地管理 Agent</p>
              </div>
            ) : (
              teams.map(team => {
                const teamAgents = agents.filter(a => team.agentIds.includes(a.id));
                return (
                  <div 
                    key={team.id}
                    className="rounded-2xl overflow-hidden"
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.6)', 
                      backdropFilter: 'blur(20px)', 
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)'
                    }}
                  >
                    {/* 团队头部 */}
                    <div className="flex items-center justify-between p-4" style={{ background: `linear-gradient(135deg, ${team.color}15 0%, ${team.color}08 100%)` }}>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                          style={{ background: team.color }}
                        >
                          {team.name[0]}
                        </div>
                        <div>
                          <h3 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>{team.name}</h3>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{teamAgents.length} 个成员</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => openEditTeamDialog(team)}
                          className="p-2 rounded-lg transition-colors hover:bg-black/5"
                          style={{ color: 'var(--text-muted)' }}
                          title="编辑团队"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmTeam(team)}
                          className="p-2 rounded-lg transition-colors hover:bg-red-50"
                          style={{ color: '#ef4444' }}
                          title="删除团队"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* 团队成员 */}
                    <div className="p-4">
                      {teamAgents.length === 0 ? (
                        <p className="text-[12px] text-center py-4" style={{ color: 'var(--text-muted)' }}>团队中暂无成员</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {teamAgents.map(agent => {
                            const avatarId = (agent as any).avatarId || '';
                            const presetAvatar = PRESET_AVATARS.find(a => a.id === avatarId);
                            return (
                              <div 
                                key={agent.id}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                                style={{ background: 'rgba(0,0,0,0.03)' }}
                              >
                                <div className="w-6 h-6 rounded-full overflow-hidden">
                                  {presetAvatar ? (
                                    <img src={presetAvatar.src} alt={agent.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold bg-black">
                                      {agent.name.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>{agent.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {showRecruitDialog && <RecruitDialog onClose={() => setShowRecruitDialog(false)} onCreate={handleCreateAgent} />}
      {deleteConfirmAgent && <DeleteConfirmDialog agentName={deleteConfirmAgent.name} onConfirm={() => void handleDeleteAgent()} onCancel={() => setDeleteConfirmAgent(null)} />}
      {avatarSelectorAgent && (
        <AvatarSelectorDialog
          agent={avatarSelectorAgent}
          currentAvatarId={(avatarSelectorAgent as any).avatarId}
          onClose={() => setAvatarSelectorAgent(null)}
          onSelect={(avatarId) => handleUpdateAvatar(avatarSelectorAgent.id, avatarId)}
        />
      )}
      {modelSelectorAgent && (
        <ModelSelectorDialog
          agent={modelSelectorAgent}
          currentModel={modelSelectorAgent.modelRef || ''}
          providerAccounts={providerAccountsList}
          onClose={() => setModelSelectorAgent(null)}
          onSelect={(providerAccountId, modelRef) => handleUpdateModel(modelSelectorAgent.id, providerAccountId, modelRef)}
        />
      )}

      {/* 团队管理对话框 */}
      {showTeamDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowTeamDialog(false)}>
          <div 
            className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="relative px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.03) 100%)' }}>
              <button onClick={() => setShowTeamDialog(false)} className="absolute top-3 right-3 p-1.5 rounded-lg" style={{ color: '#6b7280' }}>
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: editingTeam ? editingTeam.color : '#000' }}>
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#111827' }}>{editingTeam ? '编辑团队' : '创建团队'}</h2>
                  <p className="text-[11px]" style={{ color: '#6b7280' }}>{editingTeam ? '修改团队成员和名称' : '选择 Agent 组建新团队'}</p>
                </div>
              </div>
            </div>

            {/* 内容 */}
            <div className="p-6 space-y-4">
              {/* 团队名称 */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium" style={{ color: '#6b7280' }}>团队名称</label>
                <input
                  type="text"
                  value={teamNameInput}
                  onChange={(e) => setTeamNameInput(e.target.value)}
                  placeholder="输入团队名称..."
                  className="w-full px-4 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ background: '#f9fafb', border: '1px solid rgba(0,0,0,0.1)', color: '#111827' }}
                />
              </div>

              {/* 选择成员 */}
              <div className="space-y-2">
                <label className="text-[11px] font-medium" style={{ color: '#6b7280' }}>
                  选择成员 <span className="text-[10px]" style={{ color: '#9ca3af' }}>({selectedTeamAgents.length} 已选)</span>
                </label>
                <div className="max-h-60 overflow-y-auto space-y-1 p-2 rounded-xl" style={{ background: '#f9fafb', border: '1px solid rgba(0,0,0,0.08)' }}>
                  {agents.length === 0 ? (
                    <p className="text-center py-4 text-[12px]" style={{ color: '#9ca3af' }}>暂无可用 Agent</p>
                  ) : (
                    agents.map(agent => {
                      const isSelected = selectedTeamAgents.includes(agent.id);
                      const avatarId = (agent as any).avatarId || '';
                      const presetAvatar = PRESET_AVATARS.find(a => a.id === avatarId);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => {
                            setSelectedTeamAgents(prev => 
                              isSelected 
                                ? prev.filter(id => id !== agent.id)
                                : [...prev, agent.id]
                            );
                          }}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all",
                            isSelected ? "bg-black/5" : "hover:bg-black/3"
                          )}
                        >
                          <div className={cn(
                            "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                            isSelected ? "bg-black text-white" : "border border-black/20"
                          )}>
                            {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                          </div>
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                            {presetAvatar ? (
                              <img src={presetAvatar.src} alt={agent.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold bg-black">
                                {agent.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium truncate" style={{ color: '#111827' }}>{agent.name}</p>
                            <p className="text-[10px] truncate" style={{ color: '#9ca3af' }}>{agent.description || '暂无描述'}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="px-6 pb-6 flex gap-2">
              <button 
                onClick={() => setShowTeamDialog(false)} 
                className="flex-1 h-10 rounded-xl text-[12px] font-medium"
                style={{ background: '#f3f4f6', border: '1px solid rgba(0,0,0,0.08)', color: '#6b7280' }}
              >
                取消
              </button>
              <button 
                onClick={handleSaveTeam}
                disabled={!teamNameInput.trim() || selectedTeamAgents.length === 0}
                className="flex-1 h-10 rounded-xl text-[12px] font-medium flex items-center justify-center gap-2"
                style={{ 
                  background: teamNameInput.trim() && selectedTeamAgents.length > 0 ? '#000' : '#f3f4f6',
                  color: teamNameInput.trim() && selectedTeamAgents.length > 0 ? '#fff' : '#9ca3af',
                  opacity: teamNameInput.trim() && selectedTeamAgents.length > 0 ? 1 : 0.5
                }}
              >
                {editingTeam ? '保存修改' : '创建团队'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 团队删除确认对话框 */}
      {deleteConfirmTeam && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDeleteConfirmTeam(null)}>
          <div 
            className="w-full max-w-xs rounded-2xl p-6"
            style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div 
                className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'rgba(239, 68, 68, 0.1)' }}
              >
                <Trash2 className="w-5 h-5" style={{ color: '#ef4444' }} />
              </div>
              <h3 className="text-[14px] font-medium" style={{ color: '#111827' }}>确认删除团队</h3>
              <p className="text-[11px] mt-1" style={{ color: '#6b7280' }}>删除 "{deleteConfirmTeam.name}"？此操作无法撤销</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setDeleteConfirmTeam(null)} 
                className="flex-1 h-9 rounded-lg text-[11px] font-medium"
                style={{ background: '#f3f4f6', color: '#6b7280' }}
              >
                取消
              </button>
              <button 
                onClick={handleDeleteTeam}
                className="flex-1 h-9 rounded-lg text-[11px] font-medium bg-red-500 text-white"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
