/**
 * MClaw Main Layout Component
 * QClaw 风格：TitleBar 顶部 + 左侧图标导航 + 会话历史面板 + 主内容区
 */
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

export function MainLayout() {
  return (
    <div
      data-testid="main-layout"
      className="flex h-screen flex-col overflow-hidden"
      style={{ background: 'var(--theme-bg-root)' }}
    >
      {/* 顶部标题栏 */}
      <TitleBar />

      {/* 内容区: 左侧导航 + 主内容 */}
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
      </div>
    </div>
  );
}
