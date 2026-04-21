/**
 * TerminalPanel Component
 * 终端面板 - 执行命令并实时显示输出
 */
import { useState, useRef, useCallback, memo, useEffect } from 'react';
import { Terminal, Play, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { invokeIpc } from '@/lib/api-client';

interface TerminalPanelProps {
  className?: string;
  onClose?: () => void;
}

interface CommandHistory {
  cmd: string;
  output: string;
  timestamp: number;
  exitCode?: number;
}

export const TerminalPanel = memo(function TerminalPanel({ className, onClose }: TerminalPanelProps) {
  const [log, setLog] = useState('');
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [running, setRunning] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const runCommand = useCallback(async () => {
    if (!cmd.trim() || running) return;

    const command = cmd.trim();
    setRunning(true);
    setLog(prev => prev + (prev ? '\n' : '') + `$ ${command}\n`);
    setCmd('');
    setHistoryIndex(-1);

    try {
      // 使用 IPC 调用执行命令
      const result = await invokeIpc('command:run', { cmd: command }) as { output?: string; exitCode?: number };
      
      if (result && result.output) {
        setLog(prev => prev + result.output);
        const historyItem: CommandHistory = {
          cmd: command,
          output: result.output,
          timestamp: Date.now(),
          exitCode: result.exitCode ?? 0,
        };
        setHistory(prev => [...prev, historyItem]);
      } else {
        setLog(prev => prev + '[无输出]\n');
        setHistory(prev => [...prev, {
          cmd: command,
          output: '[无输出]',
          timestamp: Date.now(),
        }]);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLog(prev => prev + `Error: ${errorMsg}\n`);
      setHistory(prev => [...prev, {
        cmd: command,
        output: `Error: ${errorMsg}`,
        timestamp: Date.now(),
        exitCode: 1,
      }]);
    } finally {
      setRunning(false);
      // 聚焦输入框
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [cmd, running]);

  const clearLog = useCallback(() => {
    setLog('');
    setHistory([]);
  }, []);

  // 键盘导航历史命令
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        if (newIndex >= 0) {
          setCmd(history[history.length - 1 - newIndex].cmd);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCmd(history[history.length - 1 - newIndex].cmd);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCmd('');
      }
    }
  }, [history, historyIndex, runCommand]);

  return (
    <div className={cn(
      "flex flex-col h-full bg-[#0d0d0d] text-[#0f0] font-mono",
      className
    )}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#222] bg-[#111]">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-500" />
          <span className="text-[13px] font-medium text-emerald-400">终端</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
            onClick={clearLog}
            title="清空"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-gray-500 hover:text-gray-300"
              onClick={onClose}
              title="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 日志区域 */}
      <div 
        ref={logRef}
        className="flex-1 p-3 text-[12px] whitespace-pre-wrap overflow-y-auto leading-relaxed"
        style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace' }}
      >
        {log ? (
          <div className="space-y-1">
            {log.split('\n').map((line, idx) => (
              <div key={idx} className={cn(
                "break-all",
                line.startsWith('$') && "text-emerald-400 font-medium",
                line.startsWith('Error:') && "text-red-400"
              )}>
                {line || ' '}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-600 italic">输入命令开始...</div>
        )}
        {running && (
          <div className="flex items-center gap-2 mt-2 text-emerald-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px]">执行中...</span>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="p-3 border-t border-[#222] bg-[#111]">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500 text-[12px]">$</span>
          <input
            ref={inputRef}
            value={cmd}
            onChange={e => setCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            className={cn(
              "flex-1 bg-[#1a1a1a] text-[#0f0] border border-[#333] rounded px-2 py-1.5",
              "text-[12px] outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20",
              "placeholder:text-gray-600",
              running && "opacity-50 cursor-not-allowed"
            )}
            placeholder="输入命令回车执行 (↑↓ 浏览历史)"
            style={{ fontFamily: 'Menlo, Monaco, Consolas, monospace' }}
          />
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10",
              (!cmd.trim() || running) && "opacity-50 cursor-not-allowed"
            )}
            onClick={runCommand}
            disabled={!cmd.trim() || running}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
});

export default TerminalPanel;
