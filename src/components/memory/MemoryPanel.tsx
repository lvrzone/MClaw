/**
 * Memory Panel - 记忆管理面板
 * 新版：使用文件系统存储的 Memory 数据
 */
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Brain, User, Code, Save, Loader2 } from 'lucide-react';
import { useMemoryStore, type MemoryData } from '@/stores/memory';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function MemoryPanel() {
  const {
    memory,
    isLoading,
    loadMemory,
    updateMemory,
  } = useMemoryStore();

  // Local state for editing
  const [localMemory, setLocalMemory] = useState<MemoryData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load memory on mount
  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  // Sync local state when memory loads
  useEffect(() => {
    if (memory) {
      setLocalMemory(memory);
    }
  }, [memory]);

  const handleUpdate = (path: string, value: unknown) => {
    if (!localMemory) return;
    
    const newMemory = { ...localMemory };
    const keys = path.split('.');
    let target: Record<string, unknown> = newMemory;
    
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]] as Record<string, unknown>;
    }
    
    target[keys[keys.length - 1]] = value;
    setLocalMemory(newMemory);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!localMemory) return;
    setIsSaving(true);
    const success = await updateMemory(localMemory);
    if (success) {
      setHasChanges(false);
    }
    setIsSaving(false);
  };

  const handleAddToArray = (path: string, value: string) => {
    if (!localMemory || !value.trim()) return;
    
    const newMemory = { ...localMemory };
    const keys = path.split('.');
    let target: Record<string, unknown> = newMemory;
    
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]] as Record<string, unknown>;
    }
    
    const arr = target[keys[keys.length - 1]] as string[];
    if (!arr.includes(value.trim())) {
      target[keys[keys.length - 1]] = [...arr, value.trim()];
      setLocalMemory(newMemory);
      setHasChanges(true);
    }
  };

  const handleRemoveFromArray = (path: string, index: number) => {
    if (!localMemory) return;
    
    const newMemory = { ...localMemory };
    const keys = path.split('.');
    let target: Record<string, unknown> = newMemory;
    
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]] as Record<string, unknown>;
    }
    
    const arr = target[keys[keys.length - 1]] as string[];
    target[keys[keys.length - 1]] = arr.filter((_, i) => i !== index);
    setLocalMemory(newMemory);
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!localMemory) {
    return (
      <div className="flex flex-col h-full bg-background items-center justify-center">
        <Brain className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">无法加载记忆</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => loadMemory()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">记忆管理</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-xs text-amber-500">有未保存的更改</span>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            保存
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* User Preferences */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              用户偏好
            </h3>
            
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">代码风格</label>
              <Textarea
                value={localMemory.userPreferences.codeStyle}
                onChange={(e) => handleUpdate('userPreferences.codeStyle', e.target.value)}
                className="min-h-[60px] text-sm"
                placeholder="例如：简洁、高效、可维护"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">首选框架</label>
              <Input
                value={localMemory.userPreferences.favoriteFramework}
                onChange={(e) => handleUpdate('userPreferences.favoriteFramework', e.target.value)}
                className="text-sm"
                placeholder="例如：React"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">避免使用</label>
              <ArrayEditor
                items={localMemory.userPreferences.avoid}
                onAdd={(value) => handleAddToArray('userPreferences.avoid', value)}
                onRemove={(index) => handleRemoveFromArray('userPreferences.avoid', index)}
                placeholder="添加要避免的内容..."
              />
            </div>
          </div>

          {/* Project Context */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Code className="h-4 w-4" />
              项目上下文
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">技术栈</label>
              <ArrayEditor
                items={localMemory.projectContext.techStack}
                onAdd={(value) => handleAddToArray('projectContext.techStack', value)}
                onRemove={(index) => handleRemoveFromArray('projectContext.techStack', index)}
                placeholder="添加技术栈..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">依赖项</label>
              <ArrayEditor
                items={localMemory.projectContext.dependencies}
                onAdd={(value) => handleAddToArray('projectContext.dependencies', value)}
                onRemove={(index) => handleRemoveFromArray('projectContext.dependencies', index)}
                placeholder="添加依赖..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">近期操作</label>
              <div className="space-y-1">
                {localMemory.projectContext.recentOperations.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">暂无记录</p>
                ) : (
                  localMemory.projectContext.recentOperations.map((op, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-2 py-1.5 bg-muted/50 rounded text-xs"
                    >
                      <span className="truncate">{op}</span>
                      <button
                        onClick={() => handleRemoveFromArray('projectContext.recentOperations', index)}
                        className="ml-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// Array Editor Component
function ArrayEditor({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAdd(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          className="text-sm"
        />
        <Button size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((item, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
          >
            {item}
            <button
              onClick={() => onRemove(index)}
              className="hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
