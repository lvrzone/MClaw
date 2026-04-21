import { memo, useState, useCallback, useMemo } from 'react';
import { Lightbulb, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiffHunk {
  id: string;
  startLine: number;
  endLine: number;
  type: 'add' | 'delete' | 'modify';
  explanation?: string;
  originalText?: string;
  modifiedText?: string;
}

interface DiffExplanationProps {
  hunks: DiffHunk[];
  onHunkClick?: (hunkId: string) => void;
  onExplanationRequest?: (hunkId: string) => void;
  className?: string;
}

interface DiffHunkItemProps {
  hunk: DiffHunk;
  isExpanded: boolean;
  isRead: boolean;
  onToggleExpand: () => void;
  onToggleRead: () => void;
  onExplain: () => void;
  onClick: () => void;
}

const typeConfig = {
  add: {
    color: 'bg-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/20',
    borderColor: 'border-green-200 dark:border-green-800',
    label: 'Added',
    labelColor: 'text-green-700 dark:text-green-400',
  },
  delete: {
    color: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Deleted',
    labelColor: 'text-red-700 dark:text-red-400',
  },
  modify: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Modified',
    labelColor: 'text-blue-700 dark:text-blue-400',
  },
};

const DiffHunkItem = memo<DiffHunkItemProps>(function DiffHunkItem({
  hunk,
  isExpanded,
  isRead,
  onToggleExpand,
  onToggleRead,
  onExplain,
  onClick,
}) {
  const config = typeConfig[hunk.type];
  const hasExplanation = !!hunk.explanation;

  return (
    <div
      className={cn(
        'relative rounded-lg border transition-all duration-200',
        config.borderColor,
        config.bgColor,
        'hover:shadow-sm cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Left color bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-lg', config.color)} />

      <div className="pl-4 pr-3 py-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-500" />
              )}
            </button>

            <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20', config.labelColor)}>
              {config.label}
            </span>

            <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
              L{hunk.startLine}-{hunk.endLine}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {!hasExplanation && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onExplain();
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
              >
                <Lightbulb className="w-3 h-3" />
                Explain
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleRead();
              }}
              className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded transition-colors"
              title={isRead ? 'Mark as unread' : 'Mark as read'}
            >
              {isRead ? (
                <Eye className="w-4 h-4 text-gray-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* Code preview */}
            {(hunk.originalText || hunk.modifiedText) && (
              <div className="space-y-2">
                {hunk.originalText && hunk.type !== 'add' && (
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Original:</div>
                    <pre className="bg-red-100/50 dark:bg-red-900/20 p-2 rounded overflow-x-auto text-red-800 dark:text-red-300 font-mono">
                      {hunk.originalText}
                    </pre>
                  </div>
                )}
                {hunk.modifiedText && hunk.type !== 'delete' && (
                  <div className="text-xs">
                    <div className="text-gray-500 dark:text-gray-400 mb-1">Modified:</div>
                    <pre className="bg-green-100/50 dark:bg-green-900/20 p-2 rounded overflow-x-auto text-green-800 dark:text-green-300 font-mono">
                      {hunk.modifiedText}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Explanation */}
            {hasExplanation && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-xs font-medium text-yellow-800 dark:text-yellow-300">
                    AI Explanation
                  </span>
                </div>
                <p className="text-sm text-yellow-900 dark:text-yellow-200 leading-relaxed">
                  {hunk.explanation}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export const DiffExplanation = memo<DiffExplanationProps>(function DiffExplanation({
  hunks,
  onHunkClick,
  onExplanationRequest,
  className,
}) {
  const [expandedHunks, setExpandedHunks] = useState<Set<string>>(new Set());
  const [readHunks, setReadHunks] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = useCallback((hunkId: string) => {
    setExpandedHunks((prev) => {
      const next = new Set(prev);
      if (next.has(hunkId)) {
        next.delete(hunkId);
      } else {
        next.add(hunkId);
      }
      return next;
    });
  }, []);

  const toggleRead = useCallback((hunkId: string) => {
    setReadHunks((prev) => {
      const next = new Set(prev);
      if (next.has(hunkId)) {
        next.delete(hunkId);
      } else {
        next.add(hunkId);
      }
      return next;
    });
  }, []);

  const handleExplain = useCallback(
    (hunkId: string) => {
      onExplanationRequest?.(hunkId);
      // Auto-expand when requesting explanation
      setExpandedHunks((prev) => new Set(prev).add(hunkId));
    },
    [onExplanationRequest]
  );

  const handleHunkClick = useCallback(
    (hunkId: string) => {
      onHunkClick?.(hunkId);
    },
    [onHunkClick]
  );

  // Group hunks by file (extract file path from hunk id if available)
  const groupedHunks = useMemo(() => {
    const groups: Record<string, DiffHunk[]> = {};

    const filteredHunks = searchQuery
      ? hunks.filter(
          (h) =>
            h.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.explanation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.originalText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.modifiedText?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : hunks;

    filteredHunks.forEach((hunk) => {
      // Extract file path from hunk id (assuming format: "file:path:startLine")
      const filePath = hunk.id.split(':').slice(0, -1).join(':') || 'Unknown File';
      if (!groups[filePath]) {
        groups[filePath] = [];
      }
      groups[filePath].push(hunk);
    });

    return groups;
  }, [hunks, searchQuery]);

  const totalHunks = hunks.length;
  const readCount = readHunks.size;
  const unreadCount = totalHunks - readCount;

  if (hunks.length === 0) {
    return (
      <div className={cn('p-8 text-center text-gray-500 dark:text-gray-400', className)}>
        <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No changes to explain</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Changes</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
              {totalHunks} total
            </span>
            {unreadCount > 0 && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-700 dark:text-blue-400">
                {unreadCount} unread
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <input
          type="text"
          placeholder="Search changes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100 placeholder:text-gray-400"
        />
      </div>

      {/* Hunks list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.entries(groupedHunks).map(([filePath, fileHunks]) => (
          <div key={filePath} className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium px-1">
              <ChevronRight className="w-3 h-3" />
              <span className="truncate">{filePath}</span>
              <span className="text-gray-400 dark:text-gray-600">({fileHunks.length})</span>
            </div>
            <div className="space-y-2 pl-4">
              {fileHunks.map((hunk) => (
                <DiffHunkItem
                  key={hunk.id}
                  hunk={hunk}
                  isExpanded={expandedHunks.has(hunk.id)}
                  isRead={readHunks.has(hunk.id)}
                  onToggleExpand={() => toggleExpand(hunk.id)}
                  onToggleRead={() => toggleRead(hunk.id)}
                  onExplain={() => handleExplain(hunk.id)}
                  onClick={() => handleHunkClick(hunk.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {Object.keys(groupedHunks).length === 0 && searchQuery && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No changes match &quot;{searchQuery}&quot;</p>
          </div>
        )}
      </div>
    </div>
  );
});

export type { DiffHunk, DiffExplanationProps };
export default DiffExplanation;
