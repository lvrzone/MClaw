/**
 * Gateway Status Card Component
 * Displays current gateway status with restart control
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  XCircle,
  Circle,
  RefreshCw,
  Clock,
  Activity,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGatewayStore } from '@/stores/gateway';
import type { GatewayStatus, GatewayHealth } from '@/types/gateway';

interface GatewayStatusCardProps {
  status: GatewayStatus;
  health: GatewayHealth | null;
}

function formatUptime(uptimeSeconds?: number): string {
  if (!uptimeSeconds) return '--';
  
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  
  return `${hours}h ${minutes}m`;
}

export function GatewayStatusCard({ status, health }: GatewayStatusCardProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const restart = useGatewayStore((s) => s.restart);
  const lastError = useGatewayStore((s) => s.lastError);

  const isRunning = status.state === 'running';
  const isStarting = status.state === 'starting';
  const hasError = status.state === 'error';

  const statusIcon = isRunning
    ? <CheckCircle2 className="h-5 w-5 text-green-500" />
    : hasError
    ? <XCircle className="h-5 w-5 text-red-500" />
    : isStarting
    ? <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
    : <Circle className="h-5 w-5 text-gray-400" />;

  const statusColor = isRunning
    ? 'border-green-500/30 bg-green-500/5'
    : hasError
    ? 'border-red-500/30 bg-red-500/5'
    : isStarting
    ? 'border-yellow-500/30 bg-yellow-500/5'
    : 'border-gray-500/30 bg-gray-500/5';

  const handleRestart = async () => {
    await restart();
  };

  return (
    <div
      className={`rounded-2xl border p-5 transition-colors ${statusColor}`}
      onClick={() => navigate('/settings')}
      style={{ cursor: 'pointer' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {statusIcon}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{t('status.gateway')}</h3>
              <span className="text-[12px] px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-muted-foreground">
                {status.version || 'v1.0.0'}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {t(`status.gatewayState.${status.state}`)}
            </p>
          </div>
        </div>

        {isRunning && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => { e.stopPropagation(); void handleRestart(); }}
            disabled={isStarting}
            className="shrink-0 rounded-full h-8 px-3 text-[12px] border-black/10 dark:border-white/10"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isStarting ? 'animate-spin' : ''}`} />
            {t('status.restart')}
          </Button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-[11px] text-muted-foreground">{t('status.port')}</div>
            <div className="text-[13px] font-medium text-foreground">{status.port}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-[11px] text-muted-foreground">{t('status.uptime')}</div>
            <div className="text-[13px] font-medium text-foreground">
              {formatUptime(health?.uptime || status.uptime)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-[11px] text-muted-foreground">{t('status.pid')}</div>
            <div className="text-[13px] font-medium text-foreground">{status.pid || '--'}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-[11px] text-muted-foreground">{t('status.health')}</div>
            <div className="text-[13px] font-medium" style={{ color: health?.ok ? '#22c55e' : '#ef4444' }}>
              {health?.ok ? t('status.healthy') : t('status.unhealthy')}
            </div>
          </div>
        </div>
      </div>

      {(hasError || lastError) && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="text-[12px] text-red-500 font-medium">{t('status.error')}</div>
          <div className="text-[11px] text-red-400 mt-1">{lastError || status.error}</div>
        </div>
      )}
    </div>
  );
}

export default GatewayStatusCard;
