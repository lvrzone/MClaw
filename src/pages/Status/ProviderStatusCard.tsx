/**
 * Provider Status Card Component
 * Displays provider connection status and model list
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  XCircle,
  Circle,
  Zap,
} from 'lucide-react';

interface ProviderStatusCardProps {
  providerName: string;
  models: Array<{ name: string; status: 'active' | 'error' | 'unknown'; latency?: number }>;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastError?: string;
}

export function ProviderStatusCard({
  providerName,
  models,
  connectionStatus,
}: ProviderStatusCardProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  const statusIcon = connectionStatus === 'connected'
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : connectionStatus === 'error'
    ? <XCircle className="h-4 w-4 text-red-500" />
    : <Circle className="h-4 w-4 text-gray-400" />;

  const borderColor = connectionStatus === 'connected'
    ? 'border-green-500/20 hover:border-green-500/40'
    : connectionStatus === 'error'
    ? 'border-red-500/20 hover:border-red-500/40'
    : 'border-gray-500/20 hover:border-gray-500/40';

  return (
    <div
      className={`rounded-xl border p-4 transition-all cursor-pointer ${borderColor} bg-black/5 dark:bg-white/5`}
      onClick={() => navigate('/models')}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {statusIcon}
          <h3 className="text-[13px] font-semibold text-foreground">{providerName}</h3>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-muted-foreground">
          {models.length > 0 ? `${models.length} ${t('status.models')}` : t('status.noModels')}
        </span>
      </div>

      {models.length > 0 ? (
        <div className="space-y-1.5">
          {models.slice(0, 3).map((model, idx) => (
            <div key={idx} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground truncate max-w-[120px]">{model.name}</span>
              {model.latency !== undefined && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  <span>{model.latency}ms</span>
                </div>
              )}
            </div>
          ))}
          {models.length > 3 && (
            <div className="text-[10px] text-muted-foreground mt-1">
              +{models.length - 3} {t('status.more')}
            </div>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground italic">
          {t('status.configureModel')}
        </div>
      )}
    </div>
  );
}

export default ProviderStatusCard;
