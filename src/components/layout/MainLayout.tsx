/**
 * MClaw Main Layout Component
 * QClaw 风格：TitleBar 顶部 + 左侧图标导航 + 会话历史面板 + 主内容区
 */
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';
import { TerminalPanel } from '@/components/TerminalPanel';
import { useTerminalStore } from '@/stores/terminal';
import { cn } from '@/lib/utils';

export function MainLayout() {
  const terminalOpen = useTerminalStore((s) => s.isOpen);

  return (
    <div
      data-testid="main-layout"
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--theme-bg-root)' }}
    >
      {/* 顶部标题栏 */}
      <TitleBar />

      {/* 内容区: 左侧导航 + 主内容 + 终端面板 */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 侧边栏 (含 icon 导航 + 历史面板) */}
        <Sidebar />

        {/* 主内容区 */}
        <main
          data-testid="main-content"
          className="min-h-0 flex-1 overflow-auto"
          style={{ background: 'var(--theme-bg-root)' }}
        >
          <Outlet />
        </main>

        {/* 终端面板 - 整个应用最右侧 */}
        <div
          className={cn(
            "shrink-0 border-l border-[#222] bg-[#0d0d0d] overflow-hidden transition-all duration-300 ease-out",
            terminalOpen ? "w-80 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-4"
          )}
        >
          <div className={cn("w-80 h-full", !terminalOpen && "invisible")}>
            <TerminalPanel onClose={() => useTerminalStore.getState().close()} />
          </div>
        </div>
      </div>
    </div>
  );
}
