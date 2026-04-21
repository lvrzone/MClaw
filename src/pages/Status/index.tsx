/**
 * Status Dashboard Route Entry
 * Lazy-loaded page component
 */
import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { FeedbackState } from '@/components/common/FeedbackState';

const StatusDashboard = lazy(() => import('./StatusDashboard'));

export function Status() {
  const { t } = useTranslation('dashboard');

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <FeedbackState state="loading" title={t('status.loading')} />
        </div>
      }
    >
      <StatusDashboard />
    </Suspense>
  );
}

export default Status;
