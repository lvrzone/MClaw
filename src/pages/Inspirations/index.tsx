/**
 * Inspirations - 找灵感页面
 * 展示各种工作模板，帮助用户快速开始不同的任务类型
 */
import { useState } from 'react';
import { 
  Sparkles, 
  Code, 
  FileText, 
  Search, 
  PenTool, 
  Lightbulb,
  Layers,
  BarChart3,
  ArrowRight,
  X,
  ChevronLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/stores/chat';

// 模板分类
type TemplateCategory = 'all' | 'coding' | 'writing' | 'analysis' | 'creative';

// 工作模板定义
interface WorkTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: TemplateCategory;
  prompts: string[];
  color: string;
}

const WORK_TEMPLATES: WorkTemplate[] = [
  {
    id: 'code-review',
    name: '代码审查',
    description: '分析代码质量，发现问题',
    icon: <Code className="h-4 w-4" />,
    category: 'coding',
    prompts: ['请审查以下代码，找出潜在问题', '这段代码有哪些可以优化的地方？'],
    color: '#3b82f6',
  },
  {
    id: 'debug-assist',
    name: '调试助手',
    description: '帮助定位和修复 Bug',
    icon: <BugIcon className="h-4 w-4" />,
    category: 'coding',
    prompts: ['程序报错，请帮我分析原因', '这段代码运行结果不符合预期'],
    color: '#ef4444',
  },
  {
    id: 'architecture',
    name: '架构设计',
    description: '设计系统架构方案',
    icon: <Layers className="h-4 w-4" />,
    category: 'coding',
    prompts: ['请设计一个可扩展的系统架构', '推荐合适的技术栈方案'],
    color: '#8b5cf6',
  },
  {
    id: 'writing-assist',
    name: '写作助手',
    description: '协助撰写文档和报告',
    icon: <PenTool className="h-4 w-4" />,
    category: 'writing',
    prompts: ['帮我撰写一份项目技术文档', '润色以下文章'],
    color: '#10b981',
  },
  {
    id: 'summarize',
    name: '内容总结',
    description: '提取文本核心要点',
    icon: <FileText className="h-4 w-4" />,
    category: 'writing',
    prompts: ['总结以下文章的主要观点', '用简洁的语言概括这段内容'],
    color: '#06b6d4',
  },
  {
    id: 'research',
    name: '调研分析',
    description: '深度研究主题并分析',
    icon: <Search className="h-4 w-4" />,
    category: 'analysis',
    prompts: ['深入调研这个主题的发展趋势', '帮我研究这个方案的优缺点'],
    color: '#f59e0b',
  },
  {
    id: 'data-analysis',
    name: '数据分析',
    description: '分析数据趋势',
    icon: <BarChart3 className="h-4 w-4" />,
    category: 'analysis',
    prompts: ['分析这组数据的趋势和规律', '帮我解读这份数据报告'],
    color: '#ec4899',
  },
  {
    id: 'brainstorm',
    name: '头脑风暴',
    description: '激发创意，产生想法',
    icon: <Lightbulb className="h-4 w-4" />,
    category: 'creative',
    prompts: ['围绕这个主题进行头脑风暴', '给我 10 个创新的想法'],
    color: '#f97316',
  },
];

// Bug 图标组件
function BugIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.88 1.88" />
      <path d="M14.12 3.88L16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  );
}

const CATEGORY_CONFIG: Record<TemplateCategory, { label: string; icon: React.ReactNode }> = {
  all: { label: '全部', icon: <Sparkles className="h-3 w-3" /> },
  coding: { label: '编程', icon: <Code className="h-3 w-3" /> },
  writing: { label: '写作', icon: <PenTool className="h-3 w-3" /> },
  analysis: { label: '分析', icon: <Search className="h-3 w-3" /> },
  creative: { label: '创意', icon: <Lightbulb className="h-3 w-3" /> },
};

export function Inspirations() {
  const navigate = useNavigate();
  const newSession = useChatStore((s) => s.newSession);
  const currentSessionKey = useChatStore((s) => s.currentSessionKey);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkTemplate | null>(null);

  // 过滤模板
  const filteredTemplates = WORK_TEMPLATES.filter((template) => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // 使用模板创建新对话并跳转
  const handleUseTemplate = (template: WorkTemplate, promptIndex: number = 0) => {
    // 将模板提示词存入 localStorage（Chat页面会读取）
    const pendingPrompt = template.prompts[promptIndex] || template.prompts[0];
    localStorage.setItem('pendingPrompt', pendingPrompt);
    
    // 创建新会话
    newSession();
    
    // 跳转到聊天页面
    navigate('/');
  };

  // 预览模板 - 打开详情弹窗
  const handlePreviewTemplate = (template: WorkTemplate) => {
    setSelectedTemplate(template);
  };

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: 'var(--background)' }}
    >
      <div className="max-w-3xl mx-auto px-5 py-6">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 mb-4 text-[12px] transition-colors group"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--accent-blue)'}
          onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
        >
          <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>返回对话</span>
        </button>

        {/* 页面标题 */}
        <div className="mb-6">
          <h1 
            className="text-base font-semibold mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            找灵感
          </h1>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            选择模板快速开始
          </p>
        </div>

        {/* 搜索栏 */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="搜索模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border text-[12px] transition-all outline-none"
            style={{
              background: 'var(--secondary)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* 分类标签 */}
        <div className="flex items-center gap-1.5 mb-4 overflow-x-auto">
          {(Object.keys(CATEGORY_CONFIG) as TemplateCategory[]).map((category) => {
            const config = CATEGORY_CONFIG[category];
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap transition-all"
                style={{
                  background: isActive ? 'var(--accent-blue)' : 'var(--secondary)',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                }}
              >
                {config.icon}
                {config.label}
              </button>
            );
          })}
        </div>

        {/* 模板网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="p-4 rounded-xl cursor-pointer transition-all border group"
              style={{
                background: 'var(--card)',
                borderColor: 'var(--border)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(37,99,235,0.1)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
              onClick={() => handlePreviewTemplate(template)}
            >
              <div className="flex items-start gap-3">
                {/* 图标 */}
                <div 
                  className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${template.color}15` }}
                >
                  <div style={{ color: template.color }}>{template.icon}</div>
                </div>
                
                <div className="flex-1 min-w-0">
                  {/* 标题 - 大一点 */}
                  <h3 
                    className="text-[14px] font-semibold mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {template.name}
                  </h3>
                  <p 
                    className="text-[12px] mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {template.description}
                  </p>
                  
                  {/* 提示词预览 */}
                  <div className="space-y-1">
                    {template.prompts.slice(0, 2).map((prompt, idx) => (
                      <div 
                        key={idx}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg truncate"
                        style={{ 
                          background: 'var(--secondary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {prompt.replace(/\{.*?\}/g, '...')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* 底部操作 */}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {template.prompts.length} 个模板
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUseTemplate(template);
                  }}
                  className="text-[11px] px-3 py-1 rounded-full text-white transition-all flex items-center gap-1"
                  style={{ background: 'var(--accent-blue)' }}
                >
                  <span>使用</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 空状态 */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--theme-text-muted)', opacity: 0.4 }} />
            <p style={{ color: 'var(--theme-text-muted)' }}>没有找到匹配的模板</p>
          </div>
        )}
      </div>

      {/* 模板详情弹窗 */}
      {selectedTemplate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTemplate(null)}
        >
          {/* 遮罩 */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          
          {/* 弹窗 */}
          <div 
            className="relative w-full max-w-md rounded-2xl p-5 border"
            style={{ 
              background: 'var(--card)',
              borderColor: 'var(--border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={() => setSelectedTemplate(null)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            >
              <X className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            </button>

            {/* 内容 */}
            <div className="flex items-start gap-4 mb-5">
              <div 
                className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${selectedTemplate.color}20` }}
              >
                <div style={{ color: selectedTemplate.color }}>{selectedTemplate.icon}</div>
              </div>
              <div className="flex-1">
                <h2 
                  className="text-[16px] font-semibold mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {selectedTemplate.name}
                </h2>
                <p 
                  className="text-[12px]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {selectedTemplate.description}
                </p>
              </div>
            </div>

            {/* 提示词列表 */}
            <div className="space-y-2 mb-5">
              <p 
                className="text-[11px] font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                选择提示词开始对话
              </p>
              {selectedTemplate.prompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleUseTemplate(selectedTemplate, idx)}
                  className="w-full text-left p-3.5 rounded-xl text-[12px] transition-all border"
                  style={{
                    background: 'var(--secondary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-blue)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(37,99,235,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--secondary)';
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* 底部操作 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-medium transition-all"
                style={{ 
                  background: 'var(--secondary)',
                  color: 'var(--text-primary)',
                }}
              >
                取消
              </button>
              <button
                onClick={() => handleUseTemplate(selectedTemplate)}
                className="flex-1 py-2.5 rounded-xl text-[12px] font-medium text-white flex items-center justify-center gap-2"
                style={{ background: 'var(--accent-blue)' }}
              >
                <span>开始对话</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inspirations;
