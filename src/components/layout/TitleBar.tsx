/**
 * MClaw TitleBar Component
 * 简约标题栏：macOS 红绿灯 + Logo + MClaw 居中
 */
import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy, User, Zap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { invokeIpc } from '@/lib/api-client';
import { useGatewayStore } from '@/stores/gateway';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import logoPng from '@/assets/猫爪logo.png';

// ── TitleBar ───────────────────────────────────────────────────
export function TitleBar() {
  const platform = window.electron?.platform;
  const { t } = useTranslation(['common']);
  const gatewayStatus = useGatewayStore((s) => s.status);

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
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-2 transition-opacity"
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
          >
            <img src={logoPng} alt="MClaw" style={{ width: 28, height: 28, borderRadius: 6 }} className="object-contain" />
            <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>MClaw</span>
          </button>
        </div>
        
        {/* 右侧占位 - 对称 */}
        <div style={{ width: 70 }} />
      </div>
    );
  }

  if (platform !== 'win32') return null;
  return <WindowsTitleBar gatewayStatus={gatewayStatus} t={t} />;
}

// ── Windows TitleBar ───────────────────────────────────────────
function WindowsTitleBar({
  gatewayStatus,
}: {
  gatewayStatus: { state: string };
  t: (key: string) => string;
}) {
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
      {/* 右侧: 窗口控制 */}
      <div className="flex items-center h-full no-drag">
        <button
          onClick={() => invokeIpc('window:minimize')}
          className="flex h-full w-11 items-center justify-center transition-colors"
          style={{ color: 'var(--theme-text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={() => invokeIpc('window:maximize').then(() =>
            invokeIpc('window:isMaximized').then((val) => setMaximized(val as boolean))
          )}
          className="flex h-full w-11 items-center justify-center transition-colors"
          style={{ color: 'var(--theme-text-muted)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
        >
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => invokeIpc('window:close')}
          className="flex h-full w-11 items-center justify-center transition-colors"
          style={{ color: 'var(--theme-text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#e81123';
            (e.currentTarget as HTMLElement).style.color = 'white';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = '';
            (e.currentTarget as HTMLElement).style.color = '';
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
