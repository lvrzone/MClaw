/**
 * ToolCall - 工具调用显示组件
 * 移植自 VS Code Chat tool call rendering
 */
import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Loader2 } from 'lucide-react';

// 工具调用数据
interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

// 工具状态
type ToolStatus = 'pending' | 'executing' | 'completed' | 'error';

// 解析 JSON 参数
function parseArguments(argsString: string): Record<string, unknown> | null {
  try {
    return JSON.parse(argsString);
  } catch {
    return null;
  }
}

// 格式化 JSON 以便显示
function formatArguments(argsString: string): string {
  const parsed = parseArguments(argsString);
  if (parsed) {
    return JSON.stringify(parsed, null, 2);
  }
  return argsString;
}

// 检测参数中的文件路径
function extractFilePaths(argsString: string): string[] {
  const filePathRegex = /["']((?:[\w\-\.\/\\]+)?\/)?([\w\-\.\/\\]+)["']/g;
  const paths: string[] = [];
  let match;
  while ((match = filePathRegex.exec(argsString)) !== null) {
    if (match[2] && (match[2].includes('/') || match[2].includes('\\'))) {
      paths.push(match[2]);
    }
  }
  return [...new Set(paths)];
}

// ToolCall Props
interface ToolCallProps {
  toolCall: ToolCall;
  status?: ToolStatus;
  error?: string;
  result?: string;
  onCancel?: () => void;
}

// ToolCall 组件
export function ToolCall({ 
  toolCall, 
  status = 'pending',
  error,
  result,
  onCancel,
}: ToolCallProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  
  const { name, arguments: args } = toolCall.function;
  
  // 复制到剪贴板
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(args);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  }, [args]);
  
  // 切换展开状态
  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);
  
  // 解析参数
  const parsedArgs = parseArguments(args);
  const filePaths = extractFilePaths(args);
  
  // 获取状态图标和颜色
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Loader2 size={14} className="vscode-chat-tool-status-icon pending" />;
      case 'executing':
        return <Loader2 size={14} className="vscode-chat-tool-status-icon executing vscode-spin" />;
      case 'completed':
        return <Check size={14} className="vscode-chat-tool-status-icon completed" />;
      case 'error':
        return <span className="vscode-chat-tool-status-icon error">✕</span>;
    }
  };
  
  // 获取工具图标
  const getToolIcon = () => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('read') || lowerName.includes('file')) {
      return '📄';
    }
    if (lowerName.includes('search') || lowerName.includes('grep')) {
      return '🔍';
    }
    if (lowerName.includes('edit') || lowerName.includes('write')) {
      return '✏️';
    }
    if (lowerName.includes('run') || lowerName.includes('exec')) {
      return '▶️';
    }
    return '🔧';
  };
  
  return (
    <div className={`vscode-chat-tool-call ${status}`}>
      {/* 工具头 */}
      <div className="vscode-chat-tool-header" onClick={toggleExpand}>
        <div className="vscode-chat-tool-expand">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        
        <span className="vscode-chat-tool-icon">{getToolIcon()}</span>
        
        <span className="vscode-chat-tool-name">{name}</span>
        
        {getStatusIcon()}
        
        {status === 'executing' && onCancel && (
          <button 
            className="vscode-chat-tool-cancel"
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
          >
            取消
          </button>
        )}
        
        <button 
          className="vscode-chat-tool-copy"
          onClick={(e) => { e.stopPropagation(); handleCopy(); }}
          title="复制参数"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      
      {/* 工具内容 */}
      {isExpanded && (
        <div className="vscode-chat-tool-content">
          {/* 参数 */}
          <div className="vscode-chat-tool-section">
            <div className="vscode-chat-tool-section-header">
              <span>参数</span>
            </div>
            <div className="vscode-chat-tool-args">
              <pre className="vscode-chat-tool-args-pre">
                {parsedArgs ? (
                  <code>{formatArguments(args)}</code>
                ) : (
                  <code className="vscode-chat-raw-args">{args}</code>
                )}
              </pre>
            </div>
          </div>
          
          {/* 检测到的文件 */}
          {filePaths.length > 0 && (
            <div className="vscode-chat-tool-section">
              <div className="vscode-chat-tool-section-header">
                <span>涉及文件</span>
              </div>
              <div className="vscode-chat-tool-files">
                {filePaths.map((path, idx) => (
                  <span key={idx} className="vscode-chat-tool-file">
                    {path}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* 错误信息 */}
          {error && (
            <div className="vscode-chat-tool-section">
              <div className="vscode-chat-tool-section-header error">
                <span>错误</span>
              </div>
              <div className="vscode-chat-tool-error">
                <pre>{error}</pre>
              </div>
            </div>
          )}
          
          {/* 结果 */}
          {result && (
            <div className="vscode-chat-tool-section">
              <div className="vscode-chat-tool-section-header">
                <span>结果</span>
              </div>
              <div className="vscode-chat-tool-result">
                <pre>{result}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCall;
