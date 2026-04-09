/**
 * Chat Toolbar
 * Session selector, new session, refresh, thinking toggle, and theme toggle.
 * Rendered in the Header when on the Chat page.
 */
import { useMemo, useState, memo } from 'react';
import { RefreshCw, Brain, Bot, Sun, Moon, Monitor, History } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/stores/chat';
import { useAgentsStore } from '@/stores/agents';
import { useSettingsStore } from '@/stores/settings';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

type Theme = 'light' | 'dark' | 'system';

export const ChatToolbar = memo(function ChatToolbar() {
  const refresh = useChatStore((s) => s.refresh);
  const loading = useChatStore((s) => s.loading);
  const showThinking = useChatStore((s) => s.showThinking);
  const toggleThinking = useChatStore((s) => s.toggleThinking);
  const currentAgentId = useChatStore((s) => s.currentAgentId);
  const agents = useAgentsStore((s) => s.agents);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const messages = useChatStore((s) => s.messages);
  const { t } = useTranslation('chat');
  const currentAgentName = useMemo(
    () => (agents ?? []).find((agent) => agent.id === currentAgentId)?.name ?? currentAgentId,
    [agents, currentAgentId],
  );
  const [historyOpen, setHistoryOpen] = useState(false);

  // 获取用户消息（用于历史提问列表）
  const userMessages = useMemo(() => {
    return messages
      .filter((msg) => msg.role === 'user')
      .map((msg) => {
        // 提取文本内容
        const content = msg.content;
        let text = '';
        if (typeof content === 'string') {
          text = content;
        } else if (Array.isArray(content)) {
          text = content
            .filter((block: Record<string, unknown>) => block.type === 'text')
            .map((block: Record<string, unknown>) => (block as { text?: string }).text || '')
            .join('');
        }
        return {
          id: msg.id || String(Date.now()),
          text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
          fullText: text,
          timestamp: msg.timestamp,
        };
      })
      .filter((msg) => msg.text.trim().length > 0)
      .reverse(); // 最新在前
  }, [messages]);

  // 点击历史消息，复制到剪贴板并关闭
  const handleSelectHistory = (text: string) => {
    navigator.clipboard.writeText(text);
    setHistoryOpen(false);
  };

  // Theme toggle options
  const themeOptions: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: '浅色' },
    { value: 'dark', icon: Moon, label: '深色' },
    { value: 'system', icon: Monitor, label: '跟随系统' },
  ];

  // Cycle theme
  const cycleTheme = () => {
    const currentIndex = themeOptions.findIndex(opt => opt.value === theme);
    const nextIndex = (currentIndex + 1) % themeOptions.length;
    setTheme(themeOptions[nextIndex].value);
  };

  const CurrentThemeIcon = themeOptions.find(opt => opt.value === theme)?.icon || Monitor;

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[12px] font-medium text-foreground/80 dark:border-white/10 dark:bg-white/5">
        <Bot className="h-3.5 w-3.5 text-primary" />
        <span>{t('toolbar.currentAgent', { agent: currentAgentName })}</span>
      </div>
      {/* Refresh */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => refresh()}
        disabled={loading}
        title="刷新"
      >
        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
      </Button>

      {/* 历史提问 */}
      <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
          >
            <History className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="px-3 py-2 border-b text-sm font-medium text-foreground/80">
            历史提问
          </div>
          {userMessages.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              暂无历史提问
            </div>
          ) : (
            <ScrollArea className="h-72">
              <div className="p-2">
                {userMessages.map((msg, idx) => (
                  <button
                    key={msg.id || idx}
                    onClick={() => handleSelectHistory(msg.fullText)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-accent/50 transition-colors line-clamp-2 text-foreground/80"
                  >
                    {msg.text}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>

      {/* 思考 + 主题切换 统一按钮组 */}
      <div className="flex items-center gap-0.5 rounded-lg  bg-white/[0.5] dark:bg-white/[0.03] p-0.5">
        {/* Thinking Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 rounded-md',
            showThinking && 'bg-primary/10 text-primary',
          )}
          onClick={toggleThinking}
          title={showThinking ? '隐藏思考过程' : '显示思考过程'}
        >
          <Brain className="h-3.5 w-3.5" />
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-black/10 dark:bg-white/10" />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md"
          onClick={cycleTheme}
          title={`主题: ${theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'}`}
        >
          <CurrentThemeIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});
