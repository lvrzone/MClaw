/**
 * MClaw TitleBar Component
 * 简约标题栏：macOS 红绿灯 + Logo + MClaw 居中
 */
import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy, Settings } from 'lucide-react';
import { invokeIpc } from '@/lib/api-client';
import logoPng from '@/assets/猫爪logo.png';

// ── TitleBar ───────────────────────────────────────────────────
export function TitleBar() {
  const platform = window.electron?.platform;

  if (platform === 'darwin') {
    return (
      <div
        className="flex h-11 shrink-0 items-center border-b drag-region"
        style={{
          background: 'var(--theme-sidebar-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        {/* 左侧占位 - 避开红绿灯 */}
        <div style={{ width: 70 }} />

        {/* 居中 Logo + MClaw */}
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => { window.location.href = '/'; }}
            className="flex items-center gap-2 opacity-100 hover:opacity-80 active:opacity-60 transition-opacity cursor-pointer"
          >
            <img src={logoPng} alt="MClaw" style={{ width: 28, height: 28, borderRadius: 6 }} className="object-contain" />
            <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>MClaw</span>
          </button>
        </div>

        {/* 右侧: 重新引导按钮 */}
        <div className="flex items-center pr-3 no-drag">
          <button
            onClick={async () => {
              await invokeIpc('settings:set', 'setupComplete', false);
              window.location.href = '/setup';
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] no-drag transition-colors duration-150 cursor-pointer"
            style={{ color: 'var(--theme-text-muted)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.08)';
              (e.currentTarget as HTMLElement).style.color = 'var(--theme-text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--theme-text-muted)';
            }}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>重新引导</span>
          </button>
        </div>
      </div>
    );
  }

  if (platform !== 'win32') return null;
  return <WindowsTitleBar />;
}

// ── Windows TitleBar ───────────────────────────────────────────
function WindowsTitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    invokeIpc('window:isMaximized').then((val) => setMaximized(val as boolean));
  }, []);

  return (
    <div
      className="flex h-10 shrink-0 items-center justify-end border-b drag-region"
      style={{
        background: 'transparent',
        borderColor: 'transparent',
      }}
    >
      {/* 左侧: 重新引导按钮 */}
      <button
        onClick={async () => {
          await invokeIpc('settings:set', 'setupComplete', false);
          window.location.href = '/setup';
        }}
        className="flex items-center gap-1 h-full px-3 no-drag text-[12px] transition-colors duration-150 cursor-pointer"
        style={{ color: 'var(--theme-text-muted)' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)';
          (e.currentTarget as HTMLElement).style.color = 'var(--theme-text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--theme-text-muted)';
        }}
      >
        <Settings className="h-3.5 w-3.5" />
        <span>重新引导</span>
      </button>

      {/* 右侧: 窗口控制 */}
      <div className="flex items-center h-full no-drag">
        {/* Minimize */}
        <button
          onClick={() => invokeIpc('window:minimize')}
          className="flex h-full w-11 items-center justify-center transition-colors duration-150 cursor-pointer"
          style={{ color: 'var(--theme-text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <Minus className="h-4 w-4" />
        </button>
        {/* Maximize/Restore */}
        <button
          onClick={() => invokeIpc('window:maximize').then(() =>
            invokeIpc('window:isMaximized').then((val) => setMaximized(val as boolean))
          )}
          className="flex h-full w-11 items-center justify-center transition-colors duration-150 cursor-pointer"
          style={{ color: 'var(--theme-text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        {/* Close */}
        <button
          onClick={() => invokeIpc('window:close')}
          className="flex h-full w-11 items-center justify-center transition-colors duration-150 cursor-pointer"
          style={{ color: 'var(--theme-text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#e81123';
            (e.currentTarget as HTMLElement).style.color = 'white';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--theme-text-muted)';
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
