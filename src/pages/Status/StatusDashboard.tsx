/**
 * Status Dashboard - Main Component
 * Displays provider status, gateway status, usage stats, and quick settings
 */
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { useGatewayStore } from '@/stores/gateway';
import { useProviderStore } from '@/stores/providers';
import { GatewayStatusCard } from './GatewayStatusCard';
import { ProviderStatusCard } from './ProviderStatusCard';
import { UsageChart } from './UsageChart';
import { QuickSettings } from './QuickSettings';
import { useMemo } from 'react';

// TODO: Replace with actual API when available
const MOCK_USAGE_DATA = {
  last7Days: [
    { date: 'Mon', requests: 45 },
    { date: 'Tue', requests: 62 },
    { date: 'Wed', requests: 38 },
    { date: 'Thu', requests: 91 },
    { date: 'Fri', requests: 55 },
    { date: 'Sat', requests: 23 },
    { date: 'Sun', requests: 67 },
  ],
  totalRequests: 381,
  errorCount: 3,
  errorRate: 0.8,
  totalTokens: 125000,
};

// TODO: Replace with actual API when available
const MOCK_SESSION_DATA = {
  total: 12,
  active: 3,
  todayNew: 2,
};

function StatusDashboard() {
  const { t } = useTranslation('dashboard');
  const gatewayStatus = useGatewayStore((s) => s.status);
  const gatewayHealth = useGatewayStore((s) => s.health);
    const providers = useProviderStore((s) => s.statuses);

  // Transform provider data for cards
  const providerCards = useMemo(() => {
    return providers
      .filter((p) => p.enabled)
      .map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        models: p.model ? [{ name: p.model, status: 'active' as const }] : [],
        connectionStatus: p.hasKey ? 'connected' as const : 'disconnected' as const,
        hasKey: p.hasKey,
      }));
  }, [providers]);

  return (
    <div
      data-testid="status-page"
      className="flex flex-col -m-6 dark:bg-background h-[calc(100vh-2.5rem)] overflow-hidden"
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col h-full p-10 pt-16">
        {/* Header */}
        <PageHeader
          title={t('status.title')}
          description={t('status.description')}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-2 pb-10 min-h-0 -mr-2 space-y-6">
          {/* Gateway Status */}
          <GatewayStatusCard
            status={gatewayStatus}
            health={gatewayHealth}
          />

          {/* Provider Status Grid */}
          <div>
            <h2 className="text-sm font-medium text-foreground mb-3" style={{ color: 'var(--text-primary)' }}>
              {t('status.providers')}
            </h2>
            {providerCards.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground bg-black/5 dark:bg-white/5 rounded-2xl border border-transparent border-dashed">
                <span className="text-[13px]">{t('status.noProviders')}</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {providerCards.map((provider) => (
                  <ProviderStatusCard
                    key={provider.id}
                    providerName={provider.name}
                    models={provider.models}
                    connectionStatus={provider.connectionStatus}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Chart */}
            <div>
              <h2 className="text-sm font-medium text-foreground mb-3" style={{ color: 'var(--text-primary)' }}>
                {t('status.usageChart')}
              </h2>
              <UsageChart
                data={MOCK_USAGE_DATA.last7Days}
                totalRequests={MOCK_USAGE_DATA.totalRequests}
                totalTokens={MOCK_USAGE_DATA.totalTokens}
                errorRate={MOCK_USAGE_DATA.errorRate}
              />
            </div>

            {/* Session Stats */}
            <div>
              <h2 className="text-sm font-medium text-foreground mb-3" style={{ color: 'var(--text-primary)' }}>
                {t('status.sessions')}
              </h2>
              <div className="bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 p-5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">{MOCK_SESSION_DATA.total}</div>
                    <div className="text-[12px] text-muted-foreground mt-1">{t('status.totalSessions')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">{MOCK_SESSION_DATA.active}</div>
                    <div className="text-[12px] text-muted-foreground mt-1">{t('status.activeSessions')}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-500">{MOCK_SESSION_DATA.todayNew}</div>
                    <div className="text-[12px] text-muted-foreground mt-1">{t('status.todayNew')}</div>
                  </div>
                </div>
              </div>

              {/* Quick Settings */}
              <div className="mt-4">
                <h2 className="text-sm font-medium text-foreground mb-3" style={{ color: 'var(--text-primary)' }}>
                  {t('status.quickSettings')}
                </h2>
                <QuickSettings />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StatusDashboard;
