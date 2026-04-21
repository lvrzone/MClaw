/**
 * FilePanel Component
 * 文件面板 - 显示产物列表（匹配截图设计）
 */
import { useState, useCallback, memo, useEffect } from 'react';
import { FileText, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { invokeIpc } from '@/lib/api-client';

interface ProductFile {
  id: string;
  name: string;
  charCount: number;
  path: string;
  content?: string;
}

interface FilePanelProps {
  className?: string;
  onFileSelect?: (file: ProductFile) => void;
}

type TabType = 'product' | 'all' | 'changes' | 'preview';

export const FilePanel = memo(function FilePanel({ className, onFileSelect }: FilePanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('product');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductFile[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载产物列表
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      // 获取桌面路径
      const desktopPath = await invokeIpc('path:desktop', {});
      if (!desktopPath) {
        setProducts([]);
        return;
      }

      // 列出桌面文件
      const result = await invokeIpc('file:list', { path: desktopPath }) as { files?: Array<{ name: string; isDirectory: boolean; path: string; size?: number }> };
      if (result && Array.isArray(result.files)) {
        // 过滤出文档类文件
        const docFiles = result.files
          .filter((f: { name: string; isDirectory: boolean }) => {
            const ext = f.name.split('.').pop()?.toLowerCase();
            return !f.isDirectory && ['docx', 'doc', 'pdf', 'txt', 'md'].includes(ext || '');
          })
          .map((f: { name: string; path: string; size?: number }, idx: number) => ({
            id: String(idx + 1),
            name: f.name,
            charCount: f.size ? Math.round(f.size / 2) : 0, // 粗略估算字符数
            path: f.path,
          }));
        setProducts(docFiles);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleCopy = useCallback(async (e: React.MouseEvent, file: ProductFile) => {
    e.stopPropagation();
    try {
      // 尝试读取文件内容
      const result = await invokeIpc('file:read', { path: file.path }) as { content?: string };
      if (result && result.content) {
        navigator.clipboard.writeText(result.content);
      } else {
        navigator.clipboard.writeText(file.name);
      }
    } catch {
      // 如果读取失败，只复制文件名
      navigator.clipboard.writeText(file.name);
    }
  }, []);

  const handleSelectFile = useCallback((file: ProductFile) => {
    setSelectedFileId(file.id);
    onFileSelect?.(file);
  }, [onFileSelect]);

  const tabs: { key: TabType; label: string }[] = [
    { key: 'product', label: '产物' },
    { key: 'all', label: '全部文件' },
    { key: 'changes', label: '变更' },
    { key: 'preview', label: '预览' },
  ];

  return (
    <div className={cn("flex flex-col h-full bg-white dark:bg-background", className)}>
      {/* 顶部标签栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-border">
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "relative px-2 py-1 text-[12px] rounded-md transition-all duration-200",
                "hover:scale-105 active:scale-95",
                activeTab === tab.key
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-500 hover:bg-gray-50 dark:text-muted-foreground dark:hover:bg-muted"
              )}
            >
              {/* 背景动画 */}
              <span
                className={cn(
                  "absolute inset-0 rounded-md transition-all duration-200",
                  activeTab === tab.key
                    ? "bg-blue-50 dark:bg-blue-500/20 scale-100 opacity-100"
                    : "scale-90 opacity-0"
                )}
              />
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={loadProducts}
          disabled={loading}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors",
            loading && "animate-spin"
          )}
          title="刷新"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* 产物列表 */}
      {activeTab === 'product' && (
        <div className="flex-1 overflow-y-auto p-3">
          {/* 标题 */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] text-gray-500 dark:text-muted-foreground">
              产物列表 ({products.length})
            </div>
          </div>

          {/* 文件列表 */}
          {products.length === 0 && !loading ? (
            <div className="text-center py-8 text-[12px] text-gray-400 dark:text-muted-foreground">
              暂无产物文件
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((file, idx) => (
                <div
                  key={file.id}
                  onClick={() => handleSelectFile(file)}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all",
                    "hover:shadow-sm hover:-translate-y-0.5",
                    selectedFileId === file.id
                      ? "border-blue-400 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-500/10 shadow-blue-100 dark:shadow-none"
                      : "border-gray-100 bg-white hover:border-gray-200 dark:border-border dark:bg-card dark:hover:border-muted"
                  )}
                  style={{
                    animation: `slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 50}ms forwards`,
                    opacity: 0,
                    transform: 'translateX(8px)'
                  }}
                >
                  {/* 文档图标 */}
                  <FileText className="h-4 w-4 text-blue-500 shrink-0 transition-transform group-hover:scale-110" />

                  {/* 文件名和字符数 */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-gray-800 dark:text-foreground truncate">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-muted-foreground">
                      {file.charCount} 字符
                    </div>
                  </div>

                  {/* 复制按钮 */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleCopy(e, file)}
                  >
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 其他标签页占位 */}
      {activeTab !== 'product' && (
        <div
          className="flex-1 flex items-center justify-center text-[12px] text-gray-400 dark:text-muted-foreground"
          style={{ animation: 'smooth-fade-in-up 0.2s ease-out' }}
        >
          暂无内容
        </div>
      )}
    </div>
  );
});

export default FilePanel;
