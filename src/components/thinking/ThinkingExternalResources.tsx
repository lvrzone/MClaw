import { memo, useState } from 'react';
import { FileCode, Wrench, FileText, ChevronRight, ChevronDown, Loader2, CheckCircle, XCircle } from 'lucide-react';

export interface ResourceItem {
  id: string;
  type: 'file_edit' | 'tool_call' | 'file_read';
  label: string;
  status?: 'running' | 'completed' | 'error';
  detail?: string;
}

interface ThinkingExternalResourcesProps {
  resources: ResourceItem[];
  compact?: boolean;
}

/**
 * ThinkingExternalResources 组件
 * 展示 thinking 过程中关联的文件修改和工具调用
 */
export const ThinkingExternalResources = memo(function ThinkingExternalResources({ 
  resources, 
  compact = false 
}: ThinkingExternalResourcesProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (resources.length === 0) {
    return null;
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getIcon = (type: ResourceItem['type']) => {
    switch (type) {
      case 'file_edit':
        return <FileCode className="w-4 h-4 text-blue-500" />;
      case 'file_read':
        return <FileText className="w-4 h-4 text-gray-500" />;
      case 'tool_call':
        return <Wrench className="w-4 h-4 text-purple-500" />;
      default:
        return <Wrench className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (status?: ResourceItem['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`thinking-external-resources ${compact ? 'compact' : ''}`}>
      <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
        <Wrench className="w-3 h-3" />
        <span>External Resources ({resources.length})</span>
      </div>
      
      <div className="space-y-1">
        {resources.map((resource) => {
          const isExpanded = expandedIds.has(resource.id);
          const hasDetail = resource.detail && resource.detail.length > 0;

          return (
            <div 
              key={resource.id} 
              className="resource-item border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden"
            >
              <div 
                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
                onClick={() => hasDetail && toggleExpand(resource.id)}
              >
                {hasDetail ? (
                  isExpanded ? 
                    <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : 
                    <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                ) : (
                  <span className="w-3" />
                )}
                
                {getIcon(resource.type)}
                
                <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                  {resource.label}
                </span>
                
                {getStatusIcon(resource.status)}
              </div>

              {isExpanded && hasDetail && (
                <div className={`px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
                  <pre className="whitespace-pre-wrap break-all text-gray-600 dark:text-gray-400 font-mono">
                    {resource.detail}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
