/**
 * DiffView - 代码对比组件
 * 显示旧代码和新代码的对比
 */
import { cn } from '@/lib/utils';

interface DiffViewProps {
  oldCode: string;
  newCode: string;
  className?: string;
}

export function DiffView({ oldCode, newCode, className }: DiffViewProps) {
  return (
    <div className={cn(
      "border border-border rounded-lg overflow-hidden",
      className
    )}>
      <div className="flex text-xs">
        <div className="flex-1 p-2 bg-red-500/10 text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">
          {oldCode || '(无内容)'}
        </div>
        <div className="flex-1 p-2 bg-green-500/10 text-green-600 dark:text-green-400 font-mono whitespace-pre-wrap">
          {newCode || '(无内容)'}
        </div>
      </div>
    </div>
  );
}
