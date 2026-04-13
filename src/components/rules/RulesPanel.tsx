/**
 * Rules Panel - 编码规范配置面板
 */
import { useState } from 'react';
import { Plus, Trash2, GripVertical, FileText, BookOpen, Check } from 'lucide-react';
import { useRulesStore } from '@/stores/rules';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function RulesPanel() {
  const {
    rules,
    globalEnabled,
    autoLoadProjectRules,
    toggleRule,
    removeRule,
    setGlobalEnabled,
    setAutoLoadProjectRules,
  } = useRulesStore();

  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');

  const enabledCount = rules.filter((r) => r.enabled).length;

  const handleEdit = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      setEditingRule(ruleId);
      setEditName(rule.name);
      setEditContent(rule.content);
    }
  };

  const handleSave = () => {
    if (editingRule) {
      useRulesStore.getState().updateRule(editingRule, {
        name: editName,
        content: editContent,
      });
      setEditingRule(null);
    }
  };

  const handleCancel = () => {
    setEditingRule(null);
    setEditName('');
    setEditContent('');
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">编码规范</h2>
          {enabledCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
              {enabledCount} 个启用
            </span>
          )}
        </div>
      </div>

      {/* Global Settings */}
      <div className="px-4 py-3 space-y-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">启用编码规范</div>
            <div className="text-xs text-muted-foreground">
              将规范自动注入到 AI 系统提示词
            </div>
          </div>
          <Switch checked={globalEnabled} onCheckedChange={setGlobalEnabled} />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">自动加载项目规则</div>
            <div className="text-xs text-muted-foreground">
              自动读取 .mclaw/rules.md 文件
            </div>
          </div>
          <Switch
            checked={autoLoadProjectRules}
            onCheckedChange={setAutoLoadProjectRules}
          />
        </div>
      </div>

      {/* Rules List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无编码规范</p>
              <p className="text-xs mt-1">在项目根目录创建 .mclaw/rules.md</p>
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  'group rounded-lg border bg-card p-3 transition-all',
                  rule.enabled && 'border-primary/30 bg-primary/5'
                )}
              >
                {editingRule === rule.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      placeholder="规则名称"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full h-40 px-3 py-2 text-sm border rounded-md bg-background resize-none font-mono"
                      placeholder="输入编码规范内容..."
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={handleCancel}>
                        取消
                      </Button>
                      <Button size="sm" onClick={handleSave}>
                        <Check className="h-4 w-4 mr-1" />
                        保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div className="flex items-start gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground mt-1 opacity-0 group-hover:opacity-50 cursor-grab" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">
                            {rule.name}
                          </span>
                          {rule.category === 'other' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                              项目
                            </span>
                          )}
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {rule.content.slice(0, 100)}
                          {rule.content.length > 100 ? '...' : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => toggleRule(rule.id)}
                          className="scale-90"
                        />
                        {rule.category !== 'other' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => handleEdit(rule.id)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {rule.category !== 'other' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive"
                            onClick={() => removeRule(rule.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-muted/30">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            useRulesStore.getState().addRule({
              name: '新规范',
              content: '## 规范名称\n\n1. 规则 1\n2. 规则 2\n3. 规则 3',
              enabled: true,
              category: 'other',
            });
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          添加规范
        </Button>
      </div>
    </div>
  );
}
