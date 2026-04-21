/**
 * SlashCommandPicker - 斜杠命令选择器（高级版）
 * 对齐 VS Code chatSlashCommands.ts
 *
 * 特性：
 * - 动态命令注册（Agent 命令 + 系统命令分组）
 * - 键盘导航 + Tab 补全
 * - 命令详情面板
 * - 立即执行 / 静默执行标记
 * - 排序权重
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Sparkles, Trash2, Terminal, Download, Bug, Code2, FileText, Settings,
  ChevronRight, HelpCircle, BookOpen, Plug
} from 'lucide-react';

// ============ 命令定义 ============
export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  detail?: string;          // 详细说明
  group?: string;           // 分组: 'agent' | 'system' | 'tools' | 'debug'
  sortText?: string;        // 排序关键字
  icon?: React.ReactNode;
  /** 立即执行（不等待输入） */
  executeImmediately?: boolean;
  /** 静默执行（不显示在历史） */
  silent?: boolean;
  /** 执行回调 */
  action: () => void | Promise<void>;
  /** 关联 Agent ID */
  agentId?: string;
}

// ============ 命令注册表 ============
type CommandRegistry = Map<string, SlashCommand>;
const globalRegistry: CommandRegistry = new Map();

// 注册命令
export function registerSlashCommand(cmd: Omit<SlashCommand, 'id'> & { id: string }): () => void {
  globalRegistry.set(cmd.id, cmd as SlashCommand);
  return () => globalRegistry.delete(cmd.id);
}

// 批量注册
export function registerSlashCommands(cmds: Array<Omit<SlashCommand, 'id'> & { id: string }>): () => void {
  cmds.forEach((cmd) => globalRegistry.set(cmd.id, cmd as SlashCommand));
  return () => cmds.forEach((cmd) => globalRegistry.delete(cmd.id));
}

// 内置系统命令
function initBuiltinCommands() {
  if (globalRegistry.size > 0) return; // 已初始化

  registerSlashCommands([
    {
      id: 'clear',
      name: 'clear',
      description: '清空当前对话，开始新会话',
      detail: '清空历史记录，关闭当前会话窗口',
      group: 'system',
      sortText: 'z2_clear',
      icon: <Trash2 size={13} />,
      executeImmediately: true,
      action: () => { /* handled by session manager */ },
    },
    {
      id: 'export',
      name: 'export',
      description: '导出会话为 Markdown',
      detail: '将当前会话的所有消息导出为 .md 文件',
      group: 'system',
      sortText: 'z3_export',
      icon: <Download size={13} />,
      action: () => { /* handled by export service */ },
    },
    {
      id: 'help',
      name: 'help',
      description: '查看帮助和所有可用命令',
      detail: '显示命令列表、使用说明',
      group: 'system',
      sortText: 'z4_help',
      icon: <HelpCircle size={13} />,
      executeImmediately: true,
      action: () => { /* handled by help widget */ },
    },
    {
      id: 'terminal',
      name: 'terminal',
      description: '执行终端命令',
      detail: '在系统终端中执行命令并返回结果',
      group: 'system',
      sortText: 'z5_terminal',
      icon: <Terminal size={13} />,
      action: () => { /* handled by terminal service */ },
    },
    {
      id: 'debug',
      name: 'debug',
      description: '打开调试面板',
      detail: '显示上下文、变量、调用栈等信息',
      group: 'debug',
      sortText: 'a1_debug',
      icon: <Bug size={13} />,
      executeImmediately: true,
      action: () => { /* handled by debug panel */ },
    },
    {
      id: 'code',
      name: 'code',
      description: '生成代码片段',
      detail: '根据上下文生成代码并插入编辑器',
      group: 'tools',
      sortText: 't1_code',
      icon: <Code2 size={13} />,
      action: () => {},
    },
    {
      id: 'explain',
      name: 'explain',
      description: '解释选中代码',
      detail: '分析并解释当前选中代码的功能',
      group: 'tools',
      sortText: 't2_explain',
      icon: <BookOpen size={13} />,
      action: () => {},
    },
    {
      id: 'doc',
      name: 'doc',
      description: '生成文档注释',
      detail: '为函数/类生成 JSDoc 或其他格式注释',
      group: 'tools',
      sortText: 't3_doc',
      icon: <FileText size={13} />,
      action: () => {},
    },
    {
      id: 'config',
      name: 'config',
      description: '查看/修改配置',
      detail: '查看和修改 AI 服务配置',
      group: 'system',
      sortText: 'z6_config',
      icon: <Settings size={13} />,
      action: () => {},
    },
  ]);
}
initBuiltinCommands();

// Agent 命令注册（示例，可扩展）
export function registerAgentCommands(
  agentId: string,
  commands: Array<{ id: string; name: string; description: string; detail?: string; icon?: React.ReactNode; action: () => void }>
) {
  registerSlashCommands(
    commands.map((c) => ({
      ...c,
      id: `${agentId}/${c.id}`,
      agentId,
      group: 'agent',
      icon: c.icon ?? <Sparkles size={13} />,
    }))
  );
}

// ============ 分组配置 ============
const GROUP_CONFIG: Record<string, { label: string; order: number; icon?: React.ReactNode }> = {
  agent:  { label: 'Agent', order: 0, icon: <Sparkles size={11} /> },
  tools:  { label: 'Tools', order: 1, icon: <Plug size={11} /> },
  debug:  { label: 'Debug', order: 2, icon: <Bug size={11} /> },
  system: { label: 'System', order: 3, icon: <Settings size={11} /> },
};

// ============ Props ============
interface SlashCommandPickerProps {
  filter: string;
  onSelect: (cmd: SlashCommand, args?: string) => void;
  onClose: () => void;
  onTabComplete?: (cmd: SlashCommand) => void;
}

// ============ 组件 ============
export function SlashCommandPicker({ filter, onSelect, onClose, onTabComplete }: SlashCommandPickerProps) {
  const [selected, setSelected] = useState(0);
  const [showDetail, setShowDetail] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 按分组 + 排序过滤命令
  const filtered = React.useMemo(() => {
    const all = Array.from(globalRegistry.values());

    // 按 group + sortText 排序
    all.sort((a, b) => {
      const ga = GROUP_CONFIG[a.group || 'system']?.order ?? 99;
      const gb = GROUP_CONFIG[b.group || 'system']?.order ?? 99;
      if (ga !== gb) return ga - gb;
      return (a.sortText || a.id).localeCompare(b.sortText || b.id);
    });

    // 过滤
    if (!filter) return all;
    const lower = filter.toLowerCase();
    return all.filter((cmd) =>
      cmd.name.toLowerCase().includes(lower) ||
      cmd.description.toLowerCase().includes(lower) ||
      cmd.id.includes(lower)
    );
  }, [filter]);

  useEffect(() => { setSelected(0); }, [filter]);
  useEffect(() => { setShowDetail(false); }, [selected]);

  // 自动滚动
  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-idx="${selected}"]`) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (filtered[selected]) {
        onTabComplete?.(filtered[selected]);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selected]) {
        filtered[selected].action();
        onSelect(filtered[selected]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setShowDetail((v) => !v);
    }
  }, [filtered, selected, onSelect, onClose, onTabComplete]);

  // 按分组渲染
  const groupedItems: Array<{ group: string; commands: SlashCommand[] }> = [];
  filtered.forEach((cmd) => {
    const g = cmd.group || 'system';
    const existing = groupedItems.find((x) => x.group === g);
    if (existing) existing.commands.push(cmd);
    else groupedItems.push({ group: g, commands: [cmd] });
  });

  let globalIdx = 0;

  if (!filtered.length) {
    return (
      <div className="vscode-chat-slash-picker" ref={containerRef}>
        <div className="vscode-chat-slash-picker-empty">
          No matching commands
        </div>
      </div>
    );
  }

  return (
    <div
      className="vscode-chat-slash-picker"
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="vscode-chat-slash-picker-body">
        {/* 命令列表 */}
        <div className="vscode-chat-slash-picker-list" ref={listRef}>
          {groupedItems.map(({ group, commands }) => {
            const cfg = GROUP_CONFIG[group];
            const startIdx = globalIdx;
            return (
              <div key={group} className="vscode-chat-slash-picker-group">
                <div className="vscode-chat-slash-picker-group-label">
                  {cfg?.icon}
                  {cfg?.label}
                </div>
                {commands.map((cmd) => {
                  const idx = startIdx + commands.indexOf(cmd);
                  const isSelected = idx === selected;
                  if (isSelected) globalIdx = idx + 1;
                  return (
                    <div
                      key={cmd.id}
                      data-idx={idx}
                      className={`vscode-chat-slash-picker-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => { cmd.action(); onSelect(cmd); }}
                      onMouseEnter={() => setSelected(idx)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="vscode-chat-slash-picker-icon">{cmd.icon}</span>
                      <span className="vscode-chat-slash-picker-name">/{cmd.name}</span>
                      <span className="vscode-chat-slash-picker-desc">{cmd.description}</span>
                      <ChevronRight size={11} className="vscode-chat-slash-picker-arrow" />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* 详情面板 */}
        {showDetail && filtered[selected] && (
          <div className="vscode-chat-slash-picker-detail">
            <div className="vscode-chat-slash-picker-detail-name">
              /{filtered[selected].name}
            </div>
            <div className="vscode-chat-slash-picker-detail-desc">
              {filtered[selected].description}
            </div>
            {filtered[selected].detail && (
              <div className="vscode-chat-slash-picker-detail-extra">
                {filtered[selected].detail}
              </div>
            )}
            <div className="vscode-chat-slash-picker-detail-hint">
              Enter 执行 · Tab 补全 · → 查看详情
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
