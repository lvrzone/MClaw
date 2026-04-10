/**
 * Config Files Page - Agent 配置文件与 Json 配置查看与编辑
 * 支持：修正引导、中文解释、AI编辑功能
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileJson,
  FileText,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Save,
  Download,
  X,
  RefreshCw,
  Bot,
  User,
  Heart,
  Info,
  Wrench,
  Home,
  BookOpen,
  CheckCircle,
  AlertCircle,
  Eye,
  Code,
  FileCode,
  Settings2,
  Sparkles,
  Lightbulb,
  Wand2,
  MessageSquare,
  HelpCircle,
  Copy,
  Check,
  Book,
  Zap,
} from 'lucide-react';
import { useAgentsStore } from '@/stores/agents';
import { useProviderStore } from '@/stores/providers';
import { hostApiFetch } from '@/lib/host-api';
import { cn } from '@/lib/utils';
import {
  getAvailableModels,
  explainConfig,
  fixConfigErrors,
  improveConfig,
  type AiModelOption,
} from '@/lib/ai-service';

// 预设头像列表
import avatar01 from '@/assets/avatars/avatar-01.png';
import avatar02 from '@/assets/avatars/avatar-02.png';
import avatar03 from '@/assets/avatars/avatar-03.png';
import avatar04 from '@/assets/avatars/avatar-04.png';
import avatar05 from '@/assets/avatars/avatar-05.png';
import avatar06 from '@/assets/avatars/avatar-06.png';
import avatar07 from '@/assets/avatars/avatar-07.png';
import avatar08 from '@/assets/avatars/avatar-08.png';

const PRESET_AVATARS = [
  { id: 'avatar-01', src: avatar01 },
  { id: 'avatar-02', src: avatar02 },
  { id: 'avatar-03', src: avatar03 },
  { id: 'avatar-04', src: avatar04 },
  { id: 'avatar-05', src: avatar05 },
  { id: 'avatar-06', src: avatar06 },
  { id: 'avatar-07', src: avatar07 },
  { id: 'avatar-08', src: avatar08 },
];

function getPresetAvatarSrc(avatarId?: string): string | null {
  if (!avatarId) return null;
  const preset = PRESET_AVATARS.find(a => a.id === avatarId);
  return preset?.src || null;
}

// Agent 头像组件
function AgentAvatar({ name, avatarId, size = 20 }: { name: string; avatarId?: string; size?: number }) {
  const avatarSrc = getPresetAvatarSrc(avatarId);
  if (avatarSrc) {
    return (
      <img src={avatarSrc} alt={name} className="rounded-full shrink-0" style={{ width: size, height: size, objectFit: 'cover' }} />
    );
  }
  const initial = name ? name.charAt(0).toUpperCase() : 'A';
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
    'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  ];
  const gradient = gradients[name.length % gradients.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: size * 0.4, fontWeight: 600, flexShrink: 0 }}>
      {initial}
    </div>
  );
}

// ── 配置项中文解释 ──────────────────────────────────────────────
interface ConfigExplanation {
  pattern: RegExp;
  label: string;
  description: string;
  category: 'core' | 'agent' | 'system' | 'tools' | 'workflow';
}

// Markdown 配置项解释
const MARKDOWN_EXPLANATIONS: ConfigExplanation[] = [
  { pattern: /^#\s*(.+)/, label: '标题', description: '定义此配置的主要标题或名称', category: 'core' },
  { pattern: /^\*\*(.+?)\*\*/, label: '加粗文本', description: '重要的关键词或概念', category: 'core' },
  { pattern: /^- /, label: '列表项', description: '要点或功能列表', category: 'core' },
  { pattern: /^## /, label: '二级标题', description: '主要章节或功能模块', category: 'core' },
  { pattern: /^### /, label: '三级标题', description: '子章节或详细说明', category: 'core' },
  { pattern: /^```[\s\S]*?```/, label: '代码块', description: '代码示例或配置片段', category: 'tools' },
  { pattern: /^`([^`]+)`/, label: '内联代码', description: '变量名、函数名或配置键', category: 'tools' },
  { pattern: /角色|role/i, label: '角色定义', description: '定义 Agent 的身份和职责', category: 'agent' },
  { pattern: /性格|vibe|personality/i, label: '性格描述', description: '描述 Agent 的行为风格', category: 'agent' },
  { pattern: /边界|bou?ndar/i, label: '边界规则', description: '定义 Agent 的行为边界和安全限制', category: 'agent' },
  { pattern: /记忆|memory/i, label: '记忆机制', description: 'Agent 的跨会话记忆方式', category: 'agent' },
  { pattern: /工具|tool/i, label: '工具配置', description: 'Agent 可使用的工具列表', category: 'tools' },
  { pattern: /技能|skill/i, label: '技能配置', description: 'Agent 具备的专有技能', category: 'tools' },
  { pattern: /工作流|workflow/i, label: '工作流程', description: '任务的执行流程和步骤', category: 'workflow' },
  { pattern: /流程|process/i, label: '处理流程', description: '数据处理或决策流程', category: 'workflow' },
];

// JSON 配置项解释
const JSON_EXPLANATIONS: Record<string, { label: string; description: string; category: string }> = {
  'name': { label: '名称', description: '配置项或资源的名称', category: 'core' },
  'version': { label: '版本', description: '配置格式版本号', category: 'core' },
  'theme': { label: '主题配置', description: '界面主题和颜色方案', category: 'system' },
  'language': { label: '语言设置', description: '界面显示语言', category: 'system' },
  'apiKey': { label: 'API 密钥', description: '第三方服务的认证密钥', category: 'system' },
  'endpoint': { label: '端点地址', description: 'API 或服务的访问地址', category: 'system' },
  'model': { label: '模型配置', description: 'AI 模型的选择和参数', category: 'system' },
  'temperature': { label: '温度参数', description: 'AI 输出的随机性 (0-2，越高越随机)', category: 'system' },
  'maxTokens': { label: '最大令牌数', description: '单次响应的最大 token 数量', category: 'system' },
  'timeout': { label: '超时时间', description: '请求超时毫秒数', category: 'system' },
  'retry': { label: '重试配置', description: '失败时的重试次数', category: 'system' },
  'enabled': { label: '启用状态', description: '是否启用此功能', category: 'core' },
  'disabled': { label: '禁用状态', description: '是否禁用此功能', category: 'core' },
  'path': { label: '路径配置', description: '文件或资源的路径', category: 'system' },
  'port': { label: '端口号', description: '服务监听的端口', category: 'system' },
  'host': { label: '主机地址', description: '服务绑定的主机', category: 'system' },
  'debug': { label: '调试模式', description: '是否开启调试输出', category: 'system' },
  'logLevel': { label: '日志级别', description: '日志详细程度: debug, info, warn, error', category: 'system' },
  'cron': { label: 'Cron 表达式', description: '定时任务的时间表达式', category: 'workflow' },
  'schedule': { label: '调度配置', description: '任务执行的时间安排', category: 'workflow' },
  'action': { label: '执行动作', description: '定时任务要执行的操作', category: 'workflow' },
  'interval': { label: '执行间隔', description: '任务重复执行的间隔', category: 'workflow' },
};

// ── 错误检测 ────────────────────────────────────────────────────
interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  fix?: string;
}

function validateJson(content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  try {
    JSON.parse(content);
    return errors;
  } catch (e) {
    const err = e as SyntaxError;
    const match = err.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const lines = content.substring(0, pos).split('\n');
      const line = lines.length;
      const column = lines[lines.length - 1].length + 1;
      let message = err.message;
      let fix: string | undefined;
      if (err.message.includes('Unexpected token')) {
        message = 'JSON 语法错误：意外的符号';
        if (content[pos - 1] === ',' && (content[pos] === '}' || content[pos] === ']')) {
          fix = '删除多余的逗号';
        } else if (content[pos] === "'") {
          fix = '将单引号 \' 替换为双引号 "';
        }
      } else if (err.message.includes('Unexpected end')) {
        message = 'JSON 语法错误：意外的结束';
        fix = '检查是否缺少闭合括号 } 或 ]';
      }
      errors.push({ line, column, message, severity: 'error', fix });
    } else {
      errors.push({ line: 1, column: 1, message: err.message, severity: 'error' });
    }
  }
  return errors;
}

function validateMarkdown(content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;
  lines.forEach((line, _index) => {
    if (line.match(/^```/)) {
      inCodeBlock = !inCodeBlock;
    }
  });
  if (inCodeBlock) {
    errors.push({
      line: lines.length,
      column: 1,
      message: '代码块未闭合',
      severity: 'error',
      fix: '在文件末尾添加 ```',
    });
  }
  return errors;
}

// ── 工具提示组件 ────────────────────────────────────────────────
function Tooltip({ children, content, position = 'top' }: { children: React.ReactNode; content: string; position?: 'top' | 'bottom' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 rounded-lg text-[12px] max-w-[300px] shadow-lg border',
            'animate-in fade-in zoom-in-95 duration-150',
            position === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2'
          )}
          style={{ background: 'var(--theme-sidebar-bg)', borderColor: 'var(--theme-border)', color: 'var(--theme-text-secondary)' }}
        >
          {content}
          <div
            className={cn('absolute w-2 h-2 rotate-45', position === 'top' ? 'top-full -mt-1 left-1/2 -translate-x-1/2' : 'bottom-full -mb-1 left-1/2 -translate-x-1/2')}
            style={{ background: 'var(--theme-sidebar-bg)', borderColor: 'var(--theme-border)', borderBottom: 'none', borderRight: 'none' }}
          />
        </div>
      )}
    </div>
  );
}

// ── 模型选择器 ──────────────────────────────────────────────────
function ModelSelector({
  models,
  selected,
  onChange,
}: {
  models: AiModelOption[];
  selected: AiModelOption | null;
  onChange: (model: AiModelOption) => void;
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all hover:bg-[var(--theme-session-hover)]"
        style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--theme-accent-purple)' }}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="max-w-[120px] truncate">{selected ? selected.label : '选择模型'}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>
      
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full mt-1 right-0 z-50 w-[220px] rounded-lg shadow-xl border overflow-hidden"
            style={{ background: 'var(--theme-sidebar-bg)', borderColor: 'var(--theme-border)' }}
          >
            <div className="p-2 text-[10px] font-medium" style={{ color: 'var(--theme-text-muted)' }}>
              选择 AI 模型
            </div>
            {models.length === 0 ? (
              <div className="p-3 text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                暂无可用模型<br />请在设置中添加 AI 服务商
              </div>
            ) : (
              <div className="max-h-[200px] overflow-y-auto">
                {models.map((model) => (
                  <button
                    key={`${model.accountId}:${model.model}`}
                    onClick={() => { onChange(model); setOpen(false); }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-[11px] transition-all',
                      selected?.accountId === model.accountId && selected?.model === model.model
                        ? 'bg-purple-500/20'
                        : 'hover:bg-[var(--theme-session-hover)]'
                    )}
                    style={{ color: 'var(--theme-text-primary)' }}
                  >
                    <div className="font-medium truncate">{model.model}</div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {model.providerName}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── 侧边帮助面板 ────────────────────────────────────────────────
function HelpPanel({ 
  content, 
  fileType,
  onInsert,
  onExplain,
  onFix,
  onImprove,
  models,
  selectedModel,
  onModelChange,
  aiLoading,
}: { 
  content: string; 
  fileType: 'json' | 'markdown';
  onInsert: (text: string) => void;
  onExplain: () => void;
  onFix: () => void;
  onImprove: () => void;
  models: AiModelOption[];
  selectedModel: AiModelOption | null;
  onModelChange: (model: AiModelOption) => void;
  aiLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState<'explain' | 'guide' | 'ai'>('explain');
  const [explanations, setExplanations] = useState<Array<{ label: string; description: string; category: string }>>([]);
  
  // 分析内容获取解释
  useEffect(() => {
    if (activeTab === 'explain') {
      const found: Array<{ label: string; description: string; category: string }> = [];
      
      if (fileType === 'markdown') {
        MARKDOWN_EXPLANATIONS.forEach(exp => {
          if (exp.pattern.test(content)) {
            if (!found.some(f => f.label === exp.label)) {
              found.push({ label: exp.label, description: exp.description, category: exp.category });
            }
          }
        });
      } else {
        try {
          const parsed = JSON.parse(content);
          Object.keys(parsed).forEach(key => {
            const exp = JSON_EXPLANATIONS[key.toLowerCase()];
            if (exp) {
              found.push({ label: key, description: exp.description, category: exp.category });
            }
          });
        } catch {}
      }
      
      setExplanations(found);
    }
  }, [content, fileType, activeTab]);
  
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'core': return 'text-blue-500 bg-blue-500/10';
      case 'agent': return 'text-purple-500 bg-purple-500/10';
      case 'system': return 'text-green-500 bg-green-500/10';
      case 'tools': return 'text-orange-500 bg-orange-500/10';
      case 'workflow': return 'text-pink-500 bg-pink-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };
  
  return (
    <div className="w-[280px] shrink-0 flex flex-col border-l overflow-hidden" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}>
      {/* Tab 切换 */}
      <div className="flex border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <button
          onClick={() => setActiveTab('explain')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all',
            activeTab === 'explain' ? 'border-b-2' : 'hover:bg-[var(--theme-session-hover)]'
          )}
          style={{ color: activeTab === 'explain' ? 'var(--theme-accent-blue)' : 'var(--theme-text-secondary)', borderColor: activeTab === 'explain' ? 'var(--theme-accent-blue)' : 'transparent' }}
        >
          <Book className="h-3.5 w-3.5" />
          解释
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all',
            activeTab === 'guide' ? 'border-b-2' : 'hover:bg-[var(--theme-session-hover)]'
          )}
          style={{ color: activeTab === 'guide' ? 'var(--theme-accent-blue)' : 'var(--theme-text-secondary)', borderColor: activeTab === 'guide' ? 'var(--theme-accent-blue)' : 'transparent' }}
        >
          <HelpCircle className="h-3.5 w-3.5" />
          指南
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-all',
            activeTab === 'ai' ? 'border-b-2' : 'hover:bg-[var(--theme-session-hover)]'
          )}
          style={{ color: activeTab === 'ai' ? 'var(--theme-accent-purple)' : 'var(--theme-text-secondary)', borderColor: activeTab === 'ai' ? 'var(--theme-accent-purple)' : 'transparent' }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI
        </button>
      </div>
      
      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'explain' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>配置项解释</span>
            </div>
            
            {explanations.length > 0 ? (
              <div className="space-y-2">
                {explanations.map((exp, i) => (
                  <div key={i} className="p-2.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.1)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', getCategoryColor(exp.category))}>
                        {exp.category}
                      </span>
                      <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                        {exp.label}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: 'var(--theme-text-secondary)' }}>
                      {exp.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <MessageSquare className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }} />
                <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                  选择或编辑配置以查看解释
                </p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'guide' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-4 w-4 text-green-500" />
              <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
                {fileType === 'json' ? 'JSON 配置指南' : 'Markdown 编写指南'}
              </span>
            </div>
            
            {fileType === 'json' ? (
              <div className="space-y-3 text-[11px]">
                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>基本规则</p>
                  <ul className="space-y-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    <li>• 键名必须使用双引号</li>
                    <li>• 字符串值使用双引号</li>
                    <li>• 布尔值: true / false</li>
                    <li>• 数组用 [] 包裹</li>
                    <li>• 对象用 {} 包裹</li>
                  </ul>
                </div>
                
                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>常见问题</p>
                  <ul className="space-y-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    <li>• 最后一个元素后不要加逗号</li>
                    <li>• 不要使用单引号</li>
                    <li>• 不要注释使用 //</li>
                    <li>• 数值不能有前导零</li>
                  </ul>
                </div>
                
                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>快捷模板</p>
                  <div className="space-y-1">
                    <button
                      onClick={() => onInsert('{\n  "name": "",\n  "enabled": true\n}')}
                      className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-[var(--theme-session-hover)]"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      基础对象模板
                    </button>
                    <button
                      onClick={() => onInsert('[\n  {}\n]')}
                      className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-[var(--theme-session-hover)]"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      数组模板
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-[11px]">
                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>标题语法</p>
                  <ul className="space-y-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    <li># 一级标题</li>
                    <li>## 二级标题</li>
                    <li>### 三级标题</li>
                  </ul>
                </div>
                
                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>列表语法</p>
                  <ul className="space-y-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    <li>- 无序列表项</li>
                    <li>1. 有序列表项</li>
                    <li>- [ ] 待办事项</li>
                  </ul>
                </div>
                
                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <p className="font-medium mb-1" style={{ color: 'var(--theme-text-primary)' }}>代码块</p>
                  <code className="text-[10px]" style={{ color: 'var(--theme-accent-blue)' }}>
                    ```语言<br />
                    代码内容<br />
                    ```
                  </code>
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'ai' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>AI 辅助编辑</span>
            </div>
            
            {/* 模型选择器 */}
            <div className="mb-3">
              <div className="text-[10px] mb-1.5" style={{ color: 'var(--theme-text-muted)' }}>使用模型</div>
              <ModelSelector
                models={models}
                selected={selectedModel}
                onChange={onModelChange}
              />
            </div>
            
            <div className="space-y-2">
              <AiActionButton
                icon={<MessageSquare className="h-4 w-4" />}
                title="解释配置"
                description="用中文解释当前配置内容"
                onClick={onExplain}
                loading={aiLoading}
                disabled={!selectedModel}
              />
              
              <AiActionButton
                icon={<Wand2 className="h-4 w-4" />}
                title="优化建议"
                description="获取配置优化建议"
                onClick={onImprove}
                loading={aiLoading}
                disabled={!selectedModel}
              />
              
              <AiActionButton
                icon={<Zap className="h-4 w-4" />}
                title="修复错误"
                description="自动修复配置中的错误"
                onClick={onFix}
                loading={aiLoading}
                disabled={!selectedModel}
              />
            </div>
            
            {!selectedModel && models.length > 0 && (
              <div className="p-2.5 rounded-lg mt-4" style={{ background: 'rgba(139, 92, 246, 0.1)' }}>
                <p className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                  请先选择使用的 AI 模型
                </p>
              </div>
            )}
            
            {models.length === 0 && (
              <div className="p-2.5 rounded-lg mt-4" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                <p className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                  暂无可用模型<br />请在「AI 模型服务商」中添加并配置模型
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AiActionButton({ 
  icon, 
  title, 
  description, 
  onClick, 
  disabled,
  loading 
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string; 
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'w-full p-3 rounded-lg text-left transition-all',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--theme-session-hover)]'
      )}
      style={{ background: 'rgba(0,0,0,0.1)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        {loading ? (
          <RefreshCw className="h-4 w-4 animate-spin" style={{ color: 'var(--theme-accent-purple)' }} />
        ) : (
          <span style={{ color: 'var(--theme-accent-purple)' }}>{icon}</span>
        )}
        <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>{title}</span>
      </div>
      <p className="text-[10px] pl-6" style={{ color: 'var(--theme-text-muted)' }}>{description}</p>
    </button>
  );
}

// ── 错误面板 ────────────────────────────────────────────────────
function ErrorPanel({ errors }: { errors: ValidationError[] }) {
  const [collapsed, setCollapsed] = useState(errors.filter(e => e.severity === 'error').length > 0);
  
  if (errors.length === 0) return null;
  
  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;
  const infoCount = errors.filter(e => e.severity === 'info').length;
  
  return (
    <div className="border-t" style={{ borderColor: 'var(--theme-border)', background: 'rgba(239, 68, 68, 0.05)' }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-[var(--theme-session-hover)]"
      >
        <div className="flex items-center gap-3">
          {errorCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-red-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorCount} 错误
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-500">
              <AlertCircle className="h-3.5 w-3.5" />
              {warningCount} 警告
            </span>
          )}
          {infoCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-blue-500">
              <Info className="h-3.5 w-3.5" />
              {infoCount} 提示
            </span>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')} style={{ color: 'var(--theme-text-muted)' }} />
      </button>
      
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1.5">
          {errors.map((err, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.1)' }}
            >
              {err.severity === 'error' && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
              {err.severity === 'warning' && <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />}
              {err.severity === 'info' && <Info className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
                  <span className="font-medium" style={{ color: 'var(--theme-text-primary)' }}>行 {err.line}:</span> {err.message}
                </p>
                {err.fix && (
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--theme-accent-blue)' }}>
                    建议: {err.fix}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI 结果面板 ──────────────────────────────────────────────────
function AiResultPanel({ 
  type, 
  content, 
  onClose,
  onInsert: _onInsert,
}: { 
  type: 'explain' | 'fix' | 'improve';
  content: string;
  onClose: () => void;
  onInsert?: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  
  const titles = {
    explain: 'AI 解释',
    fix: '错误修复',
    improve: '优化建议',
  };
  
  const colors = {
    explain: 'var(--theme-accent-blue)',
    fix: 'var(--theme-accent-red)',
    improve: 'var(--theme-accent-green)',
  };
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="border-t" style={{ borderColor: 'var(--theme-border)', background: 'rgba(139, 92, 246, 0.05)' }}>
      <div className="px-4 py-2.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: colors[type] }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--theme-text-primary)' }}>
            {titles[type]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg transition-all hover:bg-[var(--theme-session-hover)]"
            style={{ color: 'var(--theme-text-muted)' }}
            title="复制"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all hover:bg-[var(--theme-session-hover)]"
            style={{ color: 'var(--theme-text-muted)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="p-4 max-h-[300px] overflow-y-auto">
        <div className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--theme-text-secondary)' }}>
          {content}
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ───────────────────────────────────────────────────────
interface ConfigFile {
  id: string;
  name: string;
  path: string;
  type: 'json' | 'markdown';
  category: 'system' | 'agent' | 'workspace';
  agentId?: string;
  agentName?: string;
  avatarId?: string;
  content: string;
  modified?: boolean;
}

const AGENT_BOOTSTRAP_FILES = [
  { name: 'SOUL.md', label: '灵魂配置', icon: Heart, description: 'Agent 的核心性格和价值观' },
  { name: 'USER.md', label: '用户配置', icon: User, description: '用户信息和使用偏好' },
  { name: 'IDENTITY.md', label: '身份配置', icon: Info, description: 'Agent 身份标识' },
  { name: 'AGENTS.md', label: 'Agents 配置', icon: Bot, description: '多 Agent 协作配置' },
  { name: 'TOOLS.md', label: '工具配置', icon: Wrench, description: '可用工具列表' },
  { name: 'HEARTBEAT.md', label: '心跳配置', icon: Heart, description: '定时任务配置' },
  { name: 'BOOT.md', label: '启动配置', icon: Home, description: '启动时执行的配置' },
];

const JSON_CONFIG_FILES = [
  { id: 'openclaw', name: 'openclaw.json', label: 'OpenClaw 主配置', icon: Settings2, description: 'OpenClaw 系统配置' },
  { id: 'cron', name: 'cron.json', label: '定时任务配置', icon: Settings2, description: 'Cron 定时任务配置' },
];

type ConfigTab = 'agent' | 'json';
type EditMode = 'edit' | 'preview';
type AiResultType = 'explain' | 'fix' | 'improve' | null;

export function ConfigFiles() {
  const [activeTab, setActiveTab] = useState<ConfigTab>('agent');
  const [loading, setLoading] = useState(true);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<ConfigFile | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('edit');
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ type: AiResultType; content: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<AiModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<AiModelOption | null>(null);
  
  const agentsStore = useAgentsStore();
  const providerStore = useProviderStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 初始化模型列表
  useEffect(() => {
    const loadModels = () => {
      const models = getAvailableModels();
      setAvailableModels(models);
      // 自动选择第一个模型
      if (models.length > 0 && !selectedModel) {
        setSelectedModel(models[0]);
      }
    };
    loadModels();
  }, [providerStore.accounts]);
  
  // 验证错误
  const validationErrors = useMemo(() => {
    if (!selectedFile || !editContent) return [];
    if (selectedFile.type === 'json') {
      return validateJson(editContent);
    } else {
      return validateMarkdown(editContent);
    }
  }, [selectedFile, editContent]);
  
  // 获取 Agent 配置文件列表
  const fetchAgentConfigFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const files: ConfigFile[] = [];
      const agents = agentsStore.agents ?? [];
      for (const agent of agents) {
        const agentId = agent.id;
        const agentName = agent.name || agentId;
        for (const fileInfo of AGENT_BOOTSTRAP_FILES) {
          try {
            const response = await hostApiFetch<{ content?: string; path?: string }>(
              `/api/config/agent/${encodeURIComponent(agentId)}/file/${fileInfo.name}`
            );
            if (response?.content !== undefined) {
              files.push({
                id: `${agentId}:${fileInfo.name}`,
                name: fileInfo.name,
                path: response.path || `~/.openclaw/workspace-${agentId}/${fileInfo.name}`,
                type: 'markdown',
                category: 'agent',
                agentId,
                agentName,
                avatarId: agent.avatarId,
                content: response.content,
              });
            }
          } catch {}
        }
      }
      return files;
    } catch (err) {
      setError('无法加载 Agent 配置文件');
      return [];
    } finally {
      setLoading(false);
    }
  }, [agentsStore.agents]);
  
  const [agentConfigFiles, setAgentConfigFiles] = useState<ConfigFile[]>([]);
  
  useEffect(() => {
    const loadFiles = async () => {
      const files = await fetchAgentConfigFiles();
      setAgentConfigFiles(files);
    };
    loadFiles();
  }, [fetchAgentConfigFiles]);
  
  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };
  
  const openFile = (file: ConfigFile) => {
    setSelectedFile({ ...file, modified: false });
    setEditContent(file.content ?? '');
    setSaveSuccess(false);
    setEditMode('edit');
    setAiResult(null);
  };
  
  const openJsonFile = async (configFile: typeof JSON_CONFIG_FILES[0]) => {
    setLoading(true);
    setError(null);
    try {
      let content = '{}';
      if (configFile.id === 'openclaw') {
        const response = await hostApiFetch<{ content?: string }>('/api/config/openclaw');
        content = response?.content || '{}';
      } else if (configFile.id === 'cron') {
        const response = await hostApiFetch<{ content?: string }>('/api/config/files');
        content = response?.content || '{}';
      }
      const file: ConfigFile = {
        id: configFile.id,
        name: configFile.name,
        path: `~/.openclaw/${configFile.name}`,
        type: 'json',
        category: 'system',
        content: content,
      };
      setSelectedFile({ ...file, modified: false });
      setEditContent(file.content);
      setSaveSuccess(false);
      setEditMode('edit');
      setAiResult(null);
    } catch (err) {
      setError('无法加载配置文件');
    } finally {
      setLoading(false);
    }
  };
  
  const handleContentChange = (content: string) => {
    setEditContent(content || '');
    if (selectedFile) {
      setSelectedFile({ ...selectedFile, modified: content !== (selectedFile.content ?? '') });
    }
  };
  
  const insertText = (text: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newContent = editContent.substring(0, start) + text + editContent.substring(end);
      handleContentChange(newContent);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };
  
  const handleAiExplain = async () => {
    if (!selectedFile || !selectedModel) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await explainConfig(editContent, selectedFile.type, selectedModel.accountId, selectedModel.model, selectedModel.baseUrl);
      if (result.success && result.content) {
        setAiResult({ type: 'explain', content: result.content });
      } else {
        setAiResult({ type: 'explain', content: `AI 解释失败: ${result.error || '未知错误'}` });
      }
    } catch (err) {
      setAiResult({ type: 'explain', content: 'AI 解释失败，请稍后重试。' });
    } finally {
      setAiLoading(false);
    }
  };
  
  const handleAiFix = async () => {
    if (!selectedFile || !selectedModel) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await fixConfigErrors(editContent, selectedFile.type, selectedModel.accountId, selectedModel.model, selectedModel.baseUrl);
      if (result.success && result.content) {
        setAiResult({ type: 'fix', content: result.content });
      } else {
        setAiResult({ type: 'fix', content: `AI 修复建议获取失败: ${result.error || '未知错误'}` });
      }
    } catch (err) {
      setAiResult({ type: 'fix', content: 'AI 修复建议获取失败，请稍后重试。' });
    } finally {
      setAiLoading(false);
    }
  };
  
  const handleAiImprove = async () => {
    if (!selectedFile || !selectedModel) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await improveConfig(editContent, selectedFile.type, selectedModel.accountId, selectedModel.model, selectedModel.baseUrl);
      if (result.success && result.content) {
        setAiResult({ type: 'improve', content: result.content });
      } else {
        setAiResult({ type: 'improve', content: `AI 优化建议获取失败: ${result.error || '未知错误'}` });
      }
    } catch (err) {
      setAiResult({ type: 'improve', content: 'AI 优化建议获取失败，请稍后重试。' });
    } finally {
      setAiLoading(false);
    }
  };
  
  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    setError(null);
    try {
      if (selectedFile.type === 'json') {
        JSON.parse(editContent);
      }
      if (selectedFile.category === 'system') {
        await hostApiFetch('/api/config/openclaw', {
          method: 'PUT',
          body: JSON.stringify({ content: editContent }),
        });
      } else {
        await hostApiFetch(
          `/api/config/agent/${encodeURIComponent(selectedFile.agentId || '')}/file/${selectedFile.name}`,
          { method: 'POST', body: JSON.stringify({ content: editContent }) }
        );
      }
      setSaveSuccess(true);
      setSelectedFile({ ...selectedFile, content: editContent, modified: false });
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };
  
  const saveAsFile = async (newFileName: string) => {
    if (!selectedFile || !selectedFile.agentId) return;
    setSaving(true);
    setError(null);
    try {
      await hostApiFetch(
        `/api/config/agent/${encodeURIComponent(selectedFile.agentId)}/file/${newFileName}`,
        { method: 'POST', body: JSON.stringify({ content: editContent }) }
      );
      setSaveSuccess(true);
      setSelectedFile({
        ...selectedFile,
        name: newFileName,
        path: `~/.openclaw/workspace-${selectedFile.agentId}/${newFileName}`,
        content: editContent,
        modified: false,
      });
      setShowSaveAsDialog(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '另存为失败');
    } finally {
      setSaving(false);
    }
  };
  
  const closeFile = () => {
    if (selectedFile?.modified) {
      if (!confirm('文件有未保存的更改，确定要关闭吗？')) return;
    }
    setSelectedFile(null);
    setEditContent('');
    setSaveSuccess(false);
    setEditMode('edit');
    setAiResult(null);
  };
  
  const agentsGrouped = agentConfigFiles.reduce((acc, file) => {
    const agentId = file.agentId || 'unknown';
    if (!acc[agentId]) {
      acc[agentId] = { id: agentId, name: file.agentName || agentId, avatarId: file.avatarId, files: [] };
    }
    acc[agentId].files.push(file);
    return acc;
  }, {} as Record<string, { id: string; name: string; avatarId?: string; files: ConfigFile[] }>);
  
  const getFileIcon = (fileName: string) => {
    const bootstrapFile = AGENT_BOOTSTRAP_FILES.find(f => f.name === fileName);
    if (bootstrapFile) {
      const Icon = bootstrapFile.icon;
      return <Icon className="h-3.5 w-3.5 text-blue-400" />;
    }
    if (fileName.endsWith('.json')) {
      return <FileJson className="h-3.5 w-3.5 text-orange-400" />;
    }
    return <FileText className="h-3.5 w-3.5 text-gray-400" />;
  };
  
  const getFileLabel = (fileName: string) => {
    const bootstrapFile = AGENT_BOOTSTRAP_FILES.find(f => f.name === fileName);
    return bootstrapFile?.label || fileName;
  };
  
  const renderMarkdown = (content: string) => {
    let html = content
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-[var(--theme-sidebar-bg)] p-3 rounded-lg my-2 overflow-x-auto"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="bg-[var(--theme-sidebar-bg)] px-1.5 py-0.5 rounded text-[var(--theme-accent-blue)]">$1</code>')
      .replace(/^### (.+)$/gm, '<h3 class="text-[15px] font-semibold mt-4 mb-2" style="color: var(--theme-text-primary)">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-[16px] font-bold mt-5 mb-2" style="color: var(--theme-text-primary)">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-[18px] font-bold mt-6 mb-3" style="color: var(--theme-text-primary)">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--theme-text-primary)">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, '<hr class="my-4 border-[var(--theme-border)]" />')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-[13px] leading-relaxed" style="color: var(--theme-text-secondary)">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-[13px] leading-relaxed" style="color: var(--theme-text-secondary)">$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[var(--theme-accent-blue)] hover:underline" target="_blank">$1</a>')
      .replace(/^(?!<[hlp]|<li|<pre|<hr)(.+)$/gm, '<p class="text-[13px] leading-relaxed my-2" style="color: var(--theme-text-secondary)">$1</p>');
    return html;
  };
  
  const refreshFiles = () => {
    if (activeTab === 'agent') {
      const loadFiles = async () => {
        const files = await fetchAgentConfigFiles();
        setAgentConfigFiles(files);
      };
      loadFiles();
    }
  };
  
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--theme-bg-root)' }}>
      {/* Tab 切换 */}
      <div
        className="px-4 py-2.5 border-b flex items-center gap-4 shrink-0"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-orange-500" />
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--theme-text-primary)' }}>配置</h2>
        </div>
        
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => setActiveTab('agent')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
              activeTab === 'agent' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'hover:bg-[var(--theme-session-hover)]'
            )}
            style={activeTab === 'agent' ? {} : { color: 'var(--theme-text-secondary)' }}
          >
            <Bot className="h-3.5 w-3.5" />
            Agent 配置
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all',
              activeTab === 'json' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'hover:bg-[var(--theme-session-hover)]'
            )}
            style={activeTab === 'json' ? {} : { color: 'var(--theme-text-secondary)' }}
          >
            <FileJson className="h-3.5 w-3.5" />
            Json 配置
          </button>
        </div>
        
        <div className="flex-1" />
        
        {/* 模型选择器 */}
        {selectedFile && availableModels.length > 0 && (
          <ModelSelector
            models={availableModels}
            selected={selectedModel}
            onChange={setSelectedModel}
          />
        )}
        
        {/* 帮助面板切换 */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={cn(
            'p-1.5 rounded-lg transition-all',
            showHelp ? 'bg-blue-500/20 text-blue-500' : 'hover:bg-[var(--theme-session-hover)]'
          )}
          style={!showHelp ? { color: 'var(--theme-text-muted)' } : {}}
          title={showHelp ? '隐藏帮助面板' : '显示帮助面板'}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        
        <button onClick={refreshFiles} disabled={loading} className="p-1.5 rounded-lg transition-all disabled:opacity-50 hover:bg-[var(--theme-session-hover)]" style={{ color: 'var(--theme-text-muted)' }} title="刷新">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧文件列表 */}
        <div
          className="w-[300px] shrink-0 flex flex-col border-r overflow-hidden"
          style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}
        >
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {activeTab === 'agent' ? (
              <>
                {Object.entries(agentsGrouped).map(([agentId, { id: _id, name, avatarId, files }]) => (
                  <div key={agentId} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
                    <button
                      onClick={() => toggleAgent(agentId)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 transition-all hover:bg-[var(--theme-session-hover)]"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <span style={{ color: 'var(--theme-text-muted)' }}>
                        {expandedAgents.has(agentId) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                      <AgentAvatar name={name} avatarId={avatarId} size={24} />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-[13px] font-medium truncate" style={{ color: 'var(--theme-text-primary)' }}>{name}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--theme-text-muted)' }}>{files.length}</span>
                    </button>
                    {expandedAgents.has(agentId) && (
                      <div className="divide-y" style={{ borderTop: '1px solid var(--theme-border)' }}>
                        {files.map(file => (
                          <button
                            key={file.id}
                            onClick={() => openFile(file)}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 text-left transition-all',
                              selectedFile?.id === file.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-[var(--theme-session-hover)]'
                            )}
                          >
                            {getFileIcon(file.name)}
                            <div className="flex-1 min-w-0">
                              <p className={cn('text-[12px] truncate', selectedFile?.id === file.id ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-[var(--theme-text-primary)]')}>
                                {getFileLabel(file.name)}
                              </p>
                              <p className="text-[9px] truncate" style={{ color: 'var(--theme-text-muted)' }}>{file.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {Object.keys(agentsGrouped).length === 0 && !loading && (
                  <div className="px-3 py-8 text-center">
                    <Bot className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }} />
                    <p className="text-[12px]" style={{ color: 'var(--theme-text-muted)' }}>暂无 Agent 配置</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--theme-text-muted)', opacity: 0.7 }}>请先在档案室创建 Agent</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {JSON_CONFIG_FILES.map(config => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={config.id}
                      onClick={() => openJsonFile(config)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all',
                        selectedFile?.id === config.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-[var(--theme-session-hover)]'
                      )}
                    >
                      <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center" style={{ background: 'var(--theme-accent-blue)', opacity: 0.15 }}>
                        <Icon className="h-5 w-5" style={{ color: 'var(--theme-accent-blue)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[13px] font-medium truncate', selectedFile?.id === config.id ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--theme-text-primary)]')}>
                          {config.label}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--theme-text-muted)' }}>{config.name}</p>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
        
        {/* 右侧编辑器/预览 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFile ? (
            <>
              {/* 编辑器头部 */}
              <div
                className="px-4 py-2.5 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(selectedFile.name)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-medium truncate" style={{ color: 'var(--theme-text-primary)' }}>{selectedFile.name}</h3>
                      {selectedFile.modified && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>已修改</span>
                      )}
                      {validationErrors.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                          <AlertCircle className="h-3 w-3" />
                          {validationErrors.filter(e => e.severity === 'error').length} 错误
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {selectedFile.path}
                      {selectedFile.agentName && ` · ${selectedFile.agentName}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {selectedFile.type === 'markdown' && (
                    <div className="flex items-center rounded-lg p-0.5 mr-2" style={{ background: 'rgba(0,0,0,0.1)' }}>
                      <button
                        onClick={() => setEditMode('edit')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all',
                          editMode === 'edit' ? 'bg-white dark:bg-[var(--theme-sidebar-bg)] shadow-sm' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-secondary)]'
                        )}
                        style={editMode === 'edit' ? { color: 'var(--theme-text-primary)' } : {}}
                      >
                        <Code className="h-3.5 w-3.5" />
                        编辑
                      </button>
                      <button
                        onClick={() => setEditMode('preview')}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all',
                          editMode === 'preview' ? 'bg-white dark:bg-[var(--theme-sidebar-bg)] shadow-sm' : 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text-secondary)]'
                        )}
                        style={editMode === 'preview' ? { color: 'var(--theme-text-primary)' } : {}}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        预览
                      </button>
                    </div>
                  )}
                  
                  {/* AI 功能按钮 */}
                  <Tooltip content="AI 解释配置">
                    <button
                      onClick={handleAiExplain}
                      disabled={aiLoading || !selectedModel}
                      className="p-1.5 rounded-lg transition-all hover:bg-[var(--theme-session-hover)] disabled:opacity-50"
                      style={{ color: 'var(--theme-accent-purple)' }}
                    >
                      <Sparkles className={cn('h-4 w-4', aiLoading && 'animate-spin')} />
                    </button>
                  </Tooltip>
                  
                  {saveSuccess && (
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: '#22c55e' }}>
                      <CheckCircle className="h-3.5 w-3.5" />
                      已保存
                    </span>
                  )}
                  {error && (
                    <span className="flex items-center gap-1 text-[11px]" style={{ color: '#ef4444' }}>
                      <AlertCircle className="h-3.5 w-3.5" />
                      {error}
                    </span>
                  )}
                  <button onClick={closeFile} className="p-1.5 rounded-lg transition-all hover:bg-[var(--theme-session-hover)]" style={{ color: 'var(--theme-text-muted)' }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              {/* AI 结果面板 */}
              {aiResult && aiResult.type && (
                <AiResultPanel
                  type={aiResult.type}
                  content={aiResult.content}
                  onClose={() => setAiResult(null)}
                />
              )}
              
              {/* 编辑器/预览内容 */}
              <div className="flex-1 overflow-hidden flex">
                <div className="flex-1 overflow-hidden">
                  {editMode === 'edit' ? (
                    <textarea
                      ref={textareaRef}
                      value={editContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      className="w-full h-full p-4 resize-none outline-none font-mono text-[13px] leading-relaxed"
                      style={{ background: 'var(--theme-bg-root)', color: 'var(--theme-text-primary)' }}
                      spellCheck={false}
                    />
                  ) : (
                    <div className="w-full h-full overflow-y-auto p-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(editContent) }} />
                  )}
                </div>
                
                {/* 右侧帮助面板 */}
                {showHelp && (
                  <HelpPanel
                    content={editContent}
                    fileType={selectedFile.type}
                    onInsert={insertText}
                    onExplain={handleAiExplain}
                    onFix={handleAiFix}
                    onImprove={handleAiImprove}
                    models={availableModels}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    aiLoading={aiLoading}
                  />
                )}
              </div>
              
              {/* 错误面板 */}
              <ErrorPanel errors={validationErrors} />
              
              {/* 编辑器底部 */}
              <div
                className="px-4 py-2.5 border-t flex items-center justify-between shrink-0"
                style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar-bg)' }}
              >
                <div className="flex items-center gap-3 text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                  <span>行数: {editContent.split('\n').length}</span>
                  <span>·</span>
                  <span>字符: {editContent.length}</span>
                  {selectedFile.type === 'json' && (
                    <>
                      <span>·</span>
                      <span className={cn(validationErrors.length > 0 ? 'text-red-500' : 'text-green-500')}>
                        JSON {validationErrors.length > 0 ? '无效' : '有效'}
                      </span>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditContent(selectedFile.content)}
                    disabled={!selectedFile.modified}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50 hover:bg-[var(--theme-session-hover)]"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    重置
                  </button>
                  {selectedFile.category === 'agent' && (
                    <button
                      onClick={() => setShowSaveAsDialog(true)}
                      disabled={!selectedFile.modified}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50 hover:bg-[var(--theme-session-hover)]"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      另存为
                    </button>
                  )}
                  <button
                    onClick={saveFile}
                    disabled={saving || !selectedFile.modified || validationErrors.length > 0}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
                    style={{
                      background: selectedFile.modified && validationErrors.length === 0 ? 'var(--theme-accent-blue)' : 'rgba(0,0,0,0.05)',
                      color: selectedFile.modified && validationErrors.length === 0 ? 'white' : 'var(--theme-text-muted)',
                    }}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <FileCode className="h-16 w-16" style={{ color: 'var(--theme-text-muted)', opacity: 0.3 }} />
              <div className="text-center">
                <p className="text-[14px] font-medium" style={{ color: 'var(--theme-text-secondary)' }}>选择要编辑的配置文件</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--theme-text-muted)' }}>点击左侧列表中的配置文件</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showSaveAsDialog && (
        <SaveAsDialog
          originalName={selectedFile?.name || ''}
          onSave={saveAsFile}
          onClose={() => setShowSaveAsDialog(false)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── 另存为对话框 ──────────────────────────────────────────────
function SaveAsDialog({ originalName, onSave, onClose, saving }: { originalName: string; onSave: (name: string) => void; onClose: () => void; saving: boolean }) {
  const [fileName, setFileName] = useState(originalName);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (fileName.trim()) onSave(fileName.trim()); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ background: 'var(--theme-sidebar-bg)' }}>
        <h3 className="text-[16px] font-semibold mb-4" style={{ color: 'var(--theme-text-primary)' }}>另存为</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--theme-text-secondary)' }}>文件名</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-all"
              style={{ background: 'var(--theme-bg-root)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-primary)' }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all hover:bg-[var(--theme-session-hover)]" style={{ color: 'var(--theme-text-secondary)' }}>取消</button>
            <button type="submit" disabled={saving || !fileName.trim()} className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50" style={{ background: 'var(--theme-accent-blue)', color: 'white' }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
