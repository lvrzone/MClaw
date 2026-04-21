/**
 * Usage Chart Component
 * Simple SVG bar chart for request history
 */
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

interface UsageDataPoint {
  date: string;
  requests: number;
}

interface UsageChartProps {
  data: UsageDataPoint[];
  totalRequests: number;
  totalTokens: number;
  errorRate: number;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function UsageChart({ data, totalRequests, totalTokens, errorRate }: UsageChartProps) {
  const { t } = useTranslation('dashboard');

  const maxRequests = useMemo(() => {
    return Math.max(...data.map((d) => d.requests), 1);
  }, [data]);

  const barWidth = 32;
  const barGap = 12;
  const chartWidth = data.length * (barWidth + barGap) - barGap;
  const chartHeight = 120;

  return (
    <div className="bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 p-5">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-foreground">{totalRequests}</div>
          <div className="text-[11px] text-muted-foreground">{t('status.totalRequests')}</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-sky-500">{formatTokens(totalTokens)}</div>
          <div className="text-[11px] text-muted-foreground">{t('status.totalTokens')}</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: errorRate > 5 ? '#ef4444' : '#22c55e' }}>
            {errorRate.toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground">{t('status.errorRate')}</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight + 24}
          className="mx-auto"
        >
          {data.map((d, i) => {
            const barHeight = (d.requests / maxRequests) * chartHeight;
            const x = i * (barWidth + barGap);
            const y = chartHeight - barHeight;

            return (
              <g key={i}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  className="fill-blue-500/80 hover:fill-blue-500 transition-colors"
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${d.date}: ${d.requests} requests`}</title>
                </rect>
                {/* Label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  className="text-[10px] fill-muted-foreground"
                >
                  {d.date}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* TODO: Placeholder for future API integration */}
      <div className="text-[10px] text-muted-foreground text-center mt-3 opacity-60">
        {t('status.last7Days')}
      </div>
    </div>
  );
}

export default UsageChart;
