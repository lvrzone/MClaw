/**
 * AutoDev - 自动开发系统面板
 * 集成代码分析、自动重构、批量操作、版本控制、任务队列
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2,
  Wrench,
  Files,
  GitBranch,
  ListTodo,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  FolderOpen,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronDown,
  FileCode,
  Settings,
  Plus,
  X,
  GitCommit,
  Upload,
  GitPullRequest,
  Layers,
  BarChart3,
} from 'lucide-react';
import { useAutoDevStore, type TaskQueueItem, type RefactorTask, type BatchOperation, type GitOperation } from '@/stores/autodev';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';

// 标签页类型
type TabType = 'analysis' | 'refactor' | 'batch' | 'git' | 'queue';

// 状态颜色映射
const statusColors = {
  pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-500', icon: Clock },
  running: { bg: 'bg-blue-500/10', text: 'text-blue-500', icon: RefreshCw },
  completed: { bg: 'bg-green-500/10', text: 'text-green-500', icon: CheckCircle2 },
  error: { bg: 'bg-red-500/10', text: 'text-red-500', icon: XCircle },
  paused: { bg: 'bg-gray-500/10', text: 'text-gray-500', icon: Pause },
};

// 代码分析面板
function AnalysisPanel() {
  const { currentProject, projectAnalysis, analyzeProject } = useAutoDevStore();
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!currentProject) {
      toast.error('请先选择项目');
      return;
    }
    setAnalyzing(true);
    try {
      await analyzeProject(currentProject);
      toast.success('项目分析完成');
    } catch {
      toast.error('分析失败');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 项目选择 */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <FolderOpen className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">当前项目</p>
          <p className="text-sm font-medium">{currentProject || '未选择'}</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !currentProject}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {analyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          {analyzing ? '分析中...' : '开始分析'}
        </button>
      </div>

      {/* 分析结果 */}
      {projectAnalysis && (
        <div className="space-y-4">
          {/* 概览卡片 */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard icon={<Files className="w-4 h-4" />} label="文件数" value={projectAnalysis.totalFiles} />
            <StatCard icon={<Code2 className="w-4 h-4" />} label="代码行" value={projectAnalysis.totalLines} />
            <StatCard icon={<AlertCircle className="w-4 h-4" />} label="问题" value={projectAnalysis.issues.errors + projectAnalysis.issues.warnings} />
            <StatCard icon={<BarChart3 className="w-4 h-4" />} label="复杂度" value={projectAnalysis.complexity.toFixed(1)} />
          </div>

          {/* 语言分布 */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium mb-3">语言分布</h4>
            <div className="space-y-2">
              {Object.entries(projectAnalysis.languages).map(([lang, count]) => (
                <div key={lang} className="flex items-center gap-3">
                  <span className="text-xs w-16">{lang}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(count / projectAnalysis.totalFiles) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 项目结构 */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium mb-3">项目结构</h4>
            <DirectoryTree node={projectAnalysis.structure} onSelect={setSelectedPath} selectedPath={selectedPath} />
          </div>
        </div>
      )}
    </div>
  );
}

// 统计卡片
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

// 目录树组件
function DirectoryTree({
  node,
  onSelect,
  selectedPath,
  level = 0,
}: {
  node: { name: string; path: string; type: 'directory' | 'file'; children?: unknown[] };
  onSelect: (path: string) => void;
  selectedPath: string | null;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const isSelected = selectedPath === node.path;

  return (
    <div>
      <button
        onClick={() => {
          if (node.type === 'directory') setExpanded(!expanded);
          onSelect(node.path);
        }}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors',
          isSelected && 'bg-primary/20',
          !isSelected && 'hover:bg-white/5'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {node.type === 'directory' && (
          expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
        )}
        {node.type === 'directory' ? <FolderOpen className="w-3.5 h-3.5 text-yellow-500" /> : <FileCode className="w-3.5 h-3.5 text-blue-500" />}
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && node.type === 'directory' && node.children && (
        <div>
          {(node.children as Array<{ name: string; path: string; type: 'directory' | 'file'; children?: unknown[] }>).map((child) => (
            <DirectoryTree key={child.path} node={child} onSelect={onSelect} selectedPath={selectedPath} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// 重构面板
function RefactorPanel() {
  const { refactorTasks, createRefactorTask, executeRefactor } = useAutoDevStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({ type: 'rename' as const, target: '', description: '' });

  const handleCreate = () => {
    if (!newTask.target || !newTask.description) {
      toast.error('请填写完整信息');
      return;
    }
    createRefactorTask({
      type: newTask.type,
      target: newTask.target,
      description: newTask.description,
      changes: [],
    });
    setShowCreate(false);
    setNewTask({ type: 'rename', target: '', description: '' });
    toast.success('重构任务已创建');
  };

  return (
    <div className="space-y-4">
      {/* 创建按钮 */}
      <button
        onClick={() => setShowCreate(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        创建重构任务
      </button>

      {/* 任务列表 */}
      <div className="space-y-2">
        {refactorTasks.map((task) => (
          <TaskCard key={task.id} task={task} onExecute={() => executeRefactor(task.id)} />
        ))}
        {refactorTasks.length === 0 && (
          <EmptyState icon={<Wrench className="w-8 h-8" />} text="暂无重构任务" />
        )}
      </div>

      {/* 创建对话框 */}
      {showCreate && (
        <Dialog onClose={() => setShowCreate(false)} title="创建重构任务">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">重构类型</label>
              <select
                value={newTask.type}
                onChange={(e) => setNewTask({ ...newTask, type: e.target.value as typeof newTask.type })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                <option value="rename">重命名</option>
                <option value="extract">提取函数</option>
                <option value="move">移动文件</option>
                <option value="format">格式化</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">目标路径</label>
              <input
                type="text"
                value={newTask.target}
                onChange={(e) => setNewTask({ ...newTask, target: e.target.value })}
                placeholder="例如: src/components/Button.tsx"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">描述</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="描述重构内容..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-sm">取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm">创建</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// 任务卡片
function TaskCard({ task, onExecute }: { task: RefactorTask; onExecute: () => void }) {
  const status = statusColors[task.status];
  const StatusIcon = status.icon;

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', status.bg)}>
            <StatusIcon className={cn('w-4 h-4', status.text)} />
          </div>
          <div>
            <p className="text-sm font-medium">{task.description}</p>
            <p className="text-xs text-muted-foreground">{task.target}</p>
          </div>
        </div>
        {task.status === 'pending' && (
          <button onClick={onExecute} className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
            <Play className="w-4 h-4" />
          </button>
        )}
      </div>
      {task.error && <p className="mt-2 text-xs text-red-500">{task.error}</p>}
    </div>
  );
}

// 批量操作面板
function BatchPanel() {
  const { batchOperations, createBatchOperation, executeBatch } = useAutoDevStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newOp, setNewOp] = useState({ name: '', pattern: '', operation: 'replace' as const });

  const handleCreate = () => {
    if (!newOp.name || !newOp.pattern) {
      toast.error('请填写完整信息');
      return;
    }
    createBatchOperation({
      name: newOp.name,
      pattern: newOp.pattern,
      operation: newOp.operation,
      config: {},
    });
    setShowCreate(false);
    setNewOp({ name: '', pattern: '', operation: 'replace' });
    toast.success('批量操作已创建');
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowCreate(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        创建批量操作
      </button>

      <div className="space-y-2">
        {batchOperations.map((op) => (
          <BatchCard key={op.id} operation={op} onExecute={() => executeBatch(op.id)} />
        ))}
        {batchOperations.length === 0 && (
          <EmptyState icon={<Layers className="w-8 h-8" />} text="暂无批量操作" />
        )}
      </div>

      {showCreate && (
        <Dialog onClose={() => setShowCreate(false)} title="创建批量操作">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">操作名称</label>
              <input
                type="text"
                value={newOp.name}
                onChange={(e) => setNewOp({ ...newOp, name: e.target.value })}
                placeholder="例如: 替换 console.log"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">文件匹配模式</label>
              <input
                type="text"
                value={newOp.pattern}
                onChange={(e) => setNewOp({ ...newOp, pattern: e.target.value })}
                placeholder="例如: src/**/*.tsx"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">操作类型</label>
              <select
                value={newOp.operation}
                onChange={(e) => setNewOp({ ...newOp, operation: e.target.value as typeof newOp.operation })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                <option value="replace">查找替换</option>
                <option value="delete">删除文件</option>
                <option value="format">格式化</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-sm">取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm">创建</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// 批量操作卡片
function BatchCard({ operation, onExecute }: { operation: BatchOperation; onExecute: () => void }) {
  const status = statusColors[operation.status];
  const StatusIcon = status.icon;

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', status.bg)}>
            <StatusIcon className={cn('w-4 h-4', status.text)} />
          </div>
          <div>
            <p className="text-sm font-medium">{operation.name}</p>
            <p className="text-xs text-muted-foreground">{operation.pattern}</p>
          </div>
        </div>
        {operation.status === 'pending' && (
          <button onClick={onExecute} className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
            <Play className="w-4 h-4" />
          </button>
        )}
      </div>
      {operation.status === 'running' && (
        <div className="mt-3">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${operation.progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{operation.progress}%</p>
        </div>
      )}
    </div>
  );
}

// Git 面板
function GitPanel() {
  const { gitOperations, createGitOperation, executeGit } = useAutoDevStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newOp, setNewOp] = useState<{ type: 'commit' | 'push' | 'pull' | 'branch'; message: string; files: string[] }>({ type: 'commit', message: '', files: [] });

  const handleCreate = () => {
    if (newOp.type === 'commit' && !newOp.message) {
      toast.error('请填写提交信息');
      return;
    }
    createGitOperation({
      type: newOp.type,
      message: newOp.message,
      files: newOp.files,
    });
    setShowCreate(false);
    setNewOp({ type: 'commit', message: '', files: [] });
    toast.success('Git 操作已创建');
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowCreate(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:bg-white/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        创建 Git 操作
      </button>

      <div className="space-y-2">
        {gitOperations.map((op) => (
          <GitCard key={op.id} operation={op} onExecute={() => executeGit(op.id)} />
        ))}
        {gitOperations.length === 0 && (
          <EmptyState icon={<GitBranch className="w-8 h-8" />} text="暂无 Git 操作" />
        )}
      </div>

      {showCreate && (
        <Dialog onClose={() => setShowCreate(false)} title="创建 Git 操作">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">操作类型</label>
              <div className="grid grid-cols-4 gap-2">
                {(['commit', 'push', 'pull', 'branch'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNewOp({ ...newOp, type })}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium transition-colors',
                      newOp.type === type ? 'bg-primary text-primary-foreground' : 'bg-white/5'
                    )}
                  >
                    {type === 'commit' && <GitCommit className="w-3.5 h-3.5 mx-auto mb-1" />}
                    {type === 'push' && <Upload className="w-3.5 h-3.5 mx-auto mb-1" />}
                    {type === 'pull' && <GitPullRequest className="w-3.5 h-3.5 mx-auto mb-1" />}
                    {type === 'branch' && <GitBranch className="w-3.5 h-3.5 mx-auto mb-1" />}
                    {type}
                  </button>
                ))}
              </div>
            </div>
            {newOp.type === 'commit' && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">提交信息</label>
                <input
                  type="text"
                  value={newOp.message}
                  onChange={(e) => setNewOp({ ...newOp, message: e.target.value })}
                  placeholder="例如: 修复登录bug"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                />
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-sm">取消</button>
              <button onClick={handleCreate} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm">创建</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// Git 操作卡片
function GitCard({ operation, onExecute }: { operation: GitOperation; onExecute: () => void }) {
  const status = statusColors[operation.status];
  const StatusIcon = status.icon;

  const typeIcons = {
    commit: GitCommit,
    push: Upload,
    pull: GitPullRequest,
    branch: GitBranch,
    merge: GitBranch,
  };
  const TypeIcon = typeIcons[operation.type];

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', status.bg)}>
            <StatusIcon className={cn('w-4 h-4', status.text)} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <TypeIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium capitalize">{operation.type}</span>
            </div>
            {operation.message && <p className="text-xs text-muted-foreground">{operation.message}</p>}
          </div>
        </div>
        {operation.status === 'pending' && (
          <button onClick={onExecute} className="p-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
            <Play className="w-4 h-4" />
          </button>
        )}
      </div>
      {operation.output && (
        <div className="mt-3 p-2 rounded-lg bg-black/30 font-mono text-xs text-muted-foreground overflow-x-auto">
          <pre>{operation.output}</pre>
        </div>
      )}
    </div>
  );
}

// 任务队列面板
function QueuePanel() {
  const { taskQueue, isProcessing, addToQueue, removeFromQueue, startQueue, pauseQueue, clearQueue } = useAutoDevStore();
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ type: 'analysis' as const, name: '' });

  const handleAdd = () => {
    if (!newItem.name) {
      toast.error('请填写任务名称');
      return;
    }
    addToQueue({
      type: newItem.type,
      name: newItem.name,
      data: {},
    });
    setShowAdd(false);
    setNewItem({ type: 'analysis', name: '' });
    toast.success('任务已添加到队列');
  };

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAdd(true)}
          className="flex-1 py-2 rounded-lg bg-white/5 text-sm flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加任务
        </button>
        {isProcessing ? (
          <button onClick={pauseQueue} className="p-2 rounded-lg bg-yellow-500/20 text-yellow-500">
            <Pause className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={startQueue} className="p-2 rounded-lg bg-green-500/20 text-green-500">
            <Play className="w-4 h-4" />
          </button>
        )}
        <button onClick={clearQueue} className="p-2 rounded-lg bg-red-500/20 text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 队列列表 */}
      <div className="space-y-2">
        {taskQueue.map((item, index) => (
          <QueueItemCard key={item.id} item={item} index={index} onRemove={() => removeFromQueue(item.id)} />
        ))}
        {taskQueue.length === 0 && (
          <EmptyState icon={<ListTodo className="w-8 h-8" />} text="任务队列为空" />
        )}
      </div>

      {showAdd && (
        <Dialog onClose={() => setShowAdd(false)} title="添加任务到队列">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">任务类型</label>
              <select
                value={newItem.type}
                onChange={(e) => setNewItem({ ...newItem, type: e.target.value as typeof newItem.type })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                <option value="analysis">代码分析</option>
                <option value="refactor">重构</option>
                <option value="batch">批量操作</option>
                <option value="git">Git 操作</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">任务名称</label>
              <input
                type="text"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="任务名称..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-sm">取消</button>
              <button onClick={handleAdd} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm">添加</button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// 队列项卡片
function QueueItemCard({ item, index, onRemove }: { item: TaskQueueItem; index: number; onRemove: () => void }) {
  const status = statusColors[item.status];
  const StatusIcon = status.icon;

  const typeLabels = {
    analysis: '分析',
    refactor: '重构',
    batch: '批量',
    git: 'Git',
  };

  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
      <div className={cn('p-1.5 rounded', status.bg)}>
        <StatusIcon className={cn('w-3.5 h-3.5', status.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        <p className="text-xs text-muted-foreground">{typeLabels[item.type]}</p>
      </div>
      {item.status === 'running' && (
        <div className="w-16">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${item.progress}%` }} />
          </div>
        </div>
      )}
      <button onClick={onRemove} className="p-1.5 rounded hover:bg-white/10 text-muted-foreground">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// 空状态
function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-muted-foreground mb-2">{icon}</div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

// 对话框组件
function Dialog({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// 主组件
export function AutoDev() {
  const [activeTab, setActiveTab] = useState<TabType>('analysis');
  const navigate = useNavigate();

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'analysis', label: '代码分析', icon: <Search className="w-4 h-4" /> },
    { id: 'refactor', label: '自动重构', icon: <Wrench className="w-4 h-4" /> },
    { id: 'batch', label: '批量操作', icon: <Layers className="w-4 h-4" /> },
    { id: 'git', label: '版本控制', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'queue', label: '任务队列', icon: <ListTodo className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <PageHeader
          title={<><span className="text-primary">Auto</span>Dev 自动开发</>}
          description="智能代码分析、自动重构、批量操作与版本控制"
          actions={
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-white/10"
            >
              <Settings className="w-4 h-4" />
            </button>
          }
        />

        {/* 标签页 */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
                activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        <div className="min-h-[400px]">
          {activeTab === 'analysis' && <AnalysisPanel />}
          {activeTab === 'refactor' && <RefactorPanel />}
          {activeTab === 'batch' && <BatchPanel />}
          {activeTab === 'git' && <GitPanel />}
          {activeTab === 'queue' && <QueuePanel />}
        </div>
      </div>
    </div>
  );
}

export default AutoDev;
