/**
 * MCP Panel - Model Context Protocol 外部工具配置面板
 */
import { useState } from 'react';
import {
  Plus,
  Trash2,
  Play,
  Square,
  RefreshCw,
  Terminal,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Wrench,
  Clock,
} from 'lucide-react';
import { useMcpStore, PRESET_SERVERS } from '@/stores/mcp';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const STATUS_COLORS = {
  stopped: 'bg-gray-500',
  starting: 'bg-yellow-500 animate-pulse',
  running: 'bg-green-500',
  error: 'bg-red-500',
};

const STATUS_LABELS = {
  stopped: '已停止',
  starting: '启动中',
  running: '运行中',
  error: '错误',
};

export function McpPanel() {
  const {
    servers,
    enabled,
    calls,
    setEnabled,
    addServer,
    removeServer,
    startServer,
    stopServer,
    clearCalls,
  } = useMcpStore();

  const [isAdding, setIsAdding] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [newServer, setNewServer] = useState({
    name: '',
    command: '',
    args: '',
  });

  const handleAdd = () => {
    if (newServer.name && newServer.command) {
      addServer({
        name: newServer.name,
        command: newServer.command,
        args: newServer.args
          .split(' ')
          .filter((a) => a.trim()),
        enabled: false,
      });
      setNewServer({ name: '', command: '', args: '' });
      setIsAdding(false);
    }
  };

  const addPreset = (preset: (typeof PRESET_SERVERS)[0]) => {
    addServer({
      name: preset.name,
      command: preset.command,
      args: preset.args,
      enabled: false,
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">MCP 工具</h2>
          {servers.filter((s) => s.status === 'running').length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
              {servers.filter((s) => s.status === 'running').length} 运行中
            </span>
          )}
        </div>
      </div>

      {/* Settings */}
      <div className="px-4 py-3 space-y-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">启用 MCP</div>
            <div className="text-xs text-muted-foreground">
              允许 AI 调用外部工具
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      {/* Servers List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无 MCP 服务器</p>
              <p className="text-xs mt-1">添加预设或自定义服务器</p>
            </div>
          ) : (
            servers.map((server) => (
              <div
                key={server.id}
                className={cn(
                  'rounded-lg border bg-card overflow-hidden',
                  server.enabled && 'border-primary/30'
                )}
              >
                {/* Server Header */}
                <div className="flex items-center gap-3 p-3">
                  <div
                    className={cn(
                      'h-2.5 w-2.5 rounded-full shrink-0',
                      STATUS_COLORS[server.status]
                    )}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {server.name}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded shrink-0',
                          server.status === 'running'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        )}
                      >
                        {STATUS_LABELS[server.status]}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate font-mono mt-0.5">
                      {server.command} {server.args?.join(' ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {server.status === 'running' ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => stopServer(server.id)}
                      >
                        <Square className="h-3.5 w-3.5" />
                      </Button>
                    ) : server.status === 'starting' ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled
                      >
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => startServer(server.id)}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 hover:text-destructive"
                      onClick={() => removeServer(server.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        setExpandedServer(
                          expandedServer === server.id ? null : server.id
                        )
                      }
                    >
                      {expandedServer === server.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedServer === server.id && (
                  <div className="px-3 pb-3 border-t bg-muted/20">
                    {server.errorMessage && (
                      <div className="mt-3 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                        <AlertCircle className="h-3.5 w-3.5 inline mr-1" />
                        {server.errorMessage}
                      </div>
                    )}

                    {server.tools.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          可用工具 ({server.tools.length})
                        </div>
                        <div className="space-y-1">
                          {server.tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="flex items-center gap-2 p-2 rounded bg-background text-sm"
                            >
                              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{tool.name}</span>
                              <span className="text-xs text-muted-foreground truncate">
                                {tool.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Presets */}
          {isAdding && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="text-sm font-medium">选择预设</div>
              <div className="space-y-2">
                {PRESET_SERVERS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => addPreset(preset)}
                    className="w-full text-left p-2 rounded bg-background hover:bg-accent transition-colors"
                  >
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {preset.description}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-1 truncate">
                      {preset.command} {preset.args?.join(' ')}
                    </div>
                  </button>
                ))}
              </div>

              <div className="text-sm font-medium pt-2 border-t">自定义</div>
              <div className="space-y-2">
                <Input
                  placeholder="名称"
                  value={newServer.name}
                  onChange={(e) =>
                    setNewServer((s) => ({ ...s, name: e.target.value }))
                  }
                />
                <Input
                  placeholder="命令"
                  value={newServer.command}
                  onChange={(e) =>
                    setNewServer((s) => ({ ...s, command: e.target.value }))
                  }
                />
                <Input
                  placeholder="参数（空格分隔）"
                  value={newServer.args}
                  onChange={(e) =>
                    setNewServer((s) => ({ ...s, args: e.target.value }))
                  }
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsAdding(false)}
                  >
                    取消
                  </Button>
                  <Button size="sm" onClick={handleAdd}>
                    添加
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-muted/30 space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          添加服务器
        </Button>

        {calls.length > 0 && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={clearCalls}
          >
            <Clock className="h-4 w-4 mr-1" />
            清除调用历史 ({calls.length})
          </Button>
        )}
      </div>
    </div>
  );
}
