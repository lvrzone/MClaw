/**
 * Unified Page Header Component
 * Provides consistent title styling across all pages with subtle gradient
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string | ReactNode;
  description?: string | ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  gradientClassName?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
  gradientClassName = 'bg-gradient-to-b from-transparent via-transparent to-black/[0.02] dark:to-white/[0.02]',
}: PageHeaderProps) {
  return (
    <div className="relative mb-6 shrink-0">
      {/* Subtle gradient background at bottom */}
      <div className={cn('absolute -bottom-6 left-0 right-0 h-6 pointer-events-none', gradientClassName)} />
      
      <div className={cn('flex flex-col md:flex-row md:items-start justify-between gap-4', className)}>
        <div>
          <h1 className={cn('text-[18px] font-semibold text-foreground tracking-tight', titleClassName)}>
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 md:mt-1">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
