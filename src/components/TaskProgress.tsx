/**
 * TaskProgress - 任务进度条组件
 * 显示任务执行进度百分比
 */
import { cn } from '@/lib/utils';

interface TaskProgressProps {
  step: number;
  total: number;
  className?: string;
}

export function TaskProgress({ step, total, className }: TaskProgressProps) {
  const percent = Math.min(100, Math.max(0, (step / total) * 100));
  const percentText = percent.toFixed(0);

  return (
    <div className={cn("relative mb-5", className)}>
      {/* 进度条背景 */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        {/* 进度条填充 */}
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {/* 百分比文字 */}
      <div className="absolute -top-5 right-0 text-xs text-muted-foreground">
        {percentText}% 完成
      </div>
    </div>
  );
}
