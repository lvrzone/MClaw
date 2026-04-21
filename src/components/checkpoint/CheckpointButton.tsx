/**
 * Checkpoint Button - 打开文件历史面板的按钮
 */
import { FileClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckpointStore } from '@/stores/checkpoint';
import { cn } from '@/lib/utils';

interface CheckpointButtonProps {
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
}

export function CheckpointButton({
  className,
  variant = 'ghost',
  size = 'icon',
}: CheckpointButtonProps) {
  const { togglePanel, groups } = useCheckpointStore();

  const checkpointCount = groups.reduce((sum, g) => sum + g.checkpoints.length, 0);

  return (
    <Button
      variant={variant}
      size={size}
      className={cn('relative', className)}
      onClick={togglePanel}
      title="文件修改历史"
    >
      <FileClock className="h-4 w-4" />
      {checkpointCount > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
          {checkpointCount > 99 ? '99+' : checkpointCount}
        </span>
      )}
    </Button>
  );
}
