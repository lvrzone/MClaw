import { memo, useState, useMemo, useCallback } from 'react';
import { Search, ChevronRight, ChevronDown, Check, Minus, Server, Wrench, Puzzle, User, Loader2, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// 工具来源分类
export type ToolSource = 'builtin' | 'mcp' | 'extension' | 'user';

// 工具状态（仅 MCP）
export type McpStatus = 'connected' | 'disconnected' | 'error' | 'connecting';

// 单个工具
export interface ToolItem {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  source: ToolSource;
  serverName?: string; // 仅 MCP
  icon?: string;
}

// 工具集（如 MCP server）
export interface ToolSet {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  source: 'mcp' | 'extension' | 'builtin' | 'user';
  serverName?: string;
  icon?: string;
  status?: McpStatus;
  tools: ToolItem[];
}

// 桶（顶级分类）
export interface ToolBucket {
  id: 'user' | 'builtin' | 'mcp' | 'extension';
  name: string;
  icon: React.ReactNode;
  sets: ToolSet[];
}

export interface ToolPickerProps {
  toolSets: ToolSet[];
  selectedToolIds: Set<string>;
  onSelectionChange: (toolIds: Set<string>) => void;
  onClose?: () => void;
  className?: string;
}

// 状态图标
const StatusIcon = memo(function StatusIcon({ status }: { status?: McpStatus }) {
  switch (status) {
    case 'connected': return <div className="w-2 h-2 rounded-full bg-green-500" />;
    case 'disconnected': return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    case 'error': return <XCircle className="w-3 h-3 text-red-500" />;
    case 'connecting': return <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" />;
    default: return null;
  }
});

// 工具节点组件
const ToolNode = memo(function ToolNode({ 
  tool, 
  isSelected, 
  onToggle 
}: { 
  tool: ToolItem; 
  isSelected: boolean; 
  onToggle: () => void;
}) {
  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent/30"
      )}
      onClick={onToggle}
    >
      <div className={cn(
        "w-4 h-4 border rounded flex items-center justify-center",
        isSelected ? "bg-primary border-primary" : "border-muted-foreground"
      )}>
        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
      <span className="text-sm truncate">{tool.name}</span>
      {tool.description && (
        <span className="text-xs text-muted-foreground truncate flex-1">{tool.description}</span>
      )}
    </div>
  );
});

// 工具集节点组件（带子工具）
const ToolSetNode = memo(function ToolSetNode({
  set,
  selectedIds,
  onToggleSet,
  onToggleTool,
  expanded,
  onToggleExpand
}: {
  set: ToolSet;
  selectedIds: Set<string>;
  onToggleSet: () => void;
  onToggleTool: (toolId: string) => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const selectedInSet = useMemo(() => 
    set.tools.filter(t => selectedIds.has(t.id)).length, 
    [set.tools, selectedIds]
  );
  const totalInSet = set.tools.length;
  const isIndeterminate = selectedInSet > 0 && selectedInSet < totalInSet;
  const isAllSelected = selectedInSet === totalInSet;

  return (
    <div className="mb-1">
      <div 
        className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent/50"
        onClick={onToggleExpand}
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <div className={cn(
          "w-4 h-4 border rounded flex items-center justify-center",
          isAllSelected ? "bg-primary border-primary" : "border-muted-foreground"
        )} onClick={(e) => { e.stopPropagation(); onToggleSet(); }}>
          {isAllSelected ? <Check className="w-3 h-3 text-primary-foreground" /> :
           isIndeterminate ? <Minus className="w-3 h-3" /> : null}
        </div>
        <StatusIcon status={set.status} />
        <span className="text-sm font-medium truncate">{set.name}</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          {selectedInSet}/{totalInSet}
        </Badge>
      </div>
      {expanded && (
        <div className="ml-6 mt-1 space-y-0.5">
          {set.tools.map(tool => (
            <ToolNode
              key={tool.id}
              tool={tool}
              isSelected={selectedIds.has(tool.id)}
              onToggle={() => onToggleTool(tool.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// 主组件
export const ToolPicker = memo(function ToolPicker({
  toolSets,
  selectedToolIds,
  onSelectionChange,
  onClose: _onClose,
  className
}: ToolPickerProps) {
  const [search, setSearch] = useState('');
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  // 按 source 分组
  const buckets = useMemo<ToolBucket[]>(() => {
    const groups: Record<ToolBucket['id'], ToolSet[]> = {
      user: [],
      builtin: [],
      mcp: [],
      extension: []
    };
    
    for (const set of toolSets) {
      if (set.source === 'mcp') groups.mcp.push(set);
      else if (set.source === 'extension') groups.extension.push(set);
      else if (set.source === 'builtin') groups.builtin.push(set);
    }
    
    // User 工具作为虚拟 set
    const userTools = toolSets.filter(s => s.source === 'user').flatMap(s => s.tools);
    if (userTools.length > 0) {
      groups.user = [{
        id: 'user-tools',
        name: '自定义工具',
        enabled: true,
        source: 'user' as ToolSet['source'],
        tools: userTools
      }];
    }
    
    return ([
      { id: 'user' as const, name: '用户', icon: <User className="w-4 h-4" />, sets: groups.user },
      { id: 'builtin' as const, name: '内置', icon: <Wrench className="w-4 h-4" />, sets: groups.builtin },
      { id: 'mcp' as const, name: 'MCP 服务器', icon: <Server className="w-4 h-4" />, sets: groups.mcp },
      { id: 'extension' as const, name: '扩展', icon: <Puzzle className="w-4 h-4" />, sets: groups.extension }
    ] as ToolBucket[]).filter(b => b.sets.length > 0);
  }, [toolSets]);

  // 搜索过滤
  const filteredBuckets = useMemo(() => {
    if (!search.trim()) return buckets;
    const query = search.toLowerCase();
    return buckets.map(bucket => ({
      ...bucket,
      sets: bucket.sets.map(set => ({
        ...set,
        tools: set.tools.filter(t => 
          t.name.toLowerCase().includes(query) || 
          t.description?.toLowerCase().includes(query)
        )
      })).filter(set => set.tools.length > 0)
    })).filter(bucket => bucket.sets.length > 0);
  }, [buckets, search]);

  const toggleSet = useCallback((set: ToolSet) => {
    const newIds = new Set(selectedToolIds);
    const allSelected = set.tools.every(t => newIds.has(t.id));
    if (allSelected) {
      set.tools.forEach(t => newIds.delete(t.id));
    } else {
      set.tools.forEach(t => newIds.add(t.id));
    }
    onSelectionChange(newIds);
  }, [selectedToolIds, onSelectionChange]);

  const toggleTool = useCallback((toolId: string) => {
    const newIds = new Set(selectedToolIds);
    if (newIds.has(toolId)) {
      newIds.delete(toolId);
    } else {
      newIds.add(toolId);
    }
    onSelectionChange(newIds);
  }, [selectedToolIds, onSelectionChange]);

  const toggleExpand = useCallback((setId: string) => {
    setExpandedSets(prev => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  }, []);

  const enableAll = useCallback(() => {
    onSelectionChange(new Set(toolSets.flatMap(s => s.tools.map(t => t.id))));
  }, [toolSets, onSelectionChange]);

  const disableAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索工具..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={enableAll}>全选</Button>
          <Button size="sm" variant="outline" onClick={disableAll}>清空</Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        {filteredBuckets.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {search ? '未找到匹配的工具' : '暂无可用工具'}
          </div>
        ) : (
          filteredBuckets.map(bucket => (
            <div key={bucket.id} className="mb-4">
              <div className="flex items-center gap-2 px-2 py-1 text-muted-foreground">
                {bucket.icon}
                <span className="text-xs font-medium uppercase">{bucket.name}</span>
              </div>
              {bucket.sets.map(set => (
                <ToolSetNode
                  key={set.id}
                  set={set}
                  selectedIds={selectedToolIds}
                  onToggleSet={() => toggleSet(set)}
                  onToggleTool={toggleTool}
                  expanded={expandedSets.has(set.id)}
                  onToggleExpand={() => toggleExpand(set.id)}
                />
              ))}
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
});

export default ToolPicker;
