/**
 * MarkdownRenderer - Markdown 内容渲染组件
 * 移植自 VS Code Chat markdownRendering
 */
import { useMemo } from 'react';

// 简单的 Markdown 解析和渲染

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// 解析代码块
function parseCodeBlocks(text: string): Array<{ type: 'text' | 'code'; content: string; language?: string }> {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    // 添加代码块之前的文本
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index);
      if (textContent.trim()) {
        parts.push({ type: 'text', content: textContent });
      }
    }
    
    // 添加代码块
    parts.push({
      type: 'code',
      language: match[1] || 'plaintext',
      content: match[2].trim()
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // 添加剩余文本
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText.trim()) {
      parts.push({ type: 'text', content: remainingText });
    }
  }
  
  return parts;
}

// 渲染行内格式
function renderInlineFormatting(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  
  let key = 0;
  for (const part of parts) {
    if (part.startsWith('`') && part.endsWith('`')) {
      // 行内代码
      result.push(
        <code key={key++} className="vscode-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    } else if (part.startsWith('**') && part.endsWith('**')) {
      // 粗体
      result.push(
        <strong key={key++}>{part.slice(2, -2)}</strong>
      );
    } else if (part.startsWith('*') && part.endsWith('*')) {
      // 斜体
      result.push(
        <em key={key++}>{part.slice(1, -1)}</em>
      );
    } else {
      result.push(part);
    }
  }
  
  return result;
}

// 渲染文本段落
function renderText(text: string): React.ReactNode {
  const lines = text.split('\n');
  
  return (
    <>
      {lines.map((line, lineIdx) => {
        // 处理标题
        if (line.startsWith('# ')) {
          return <h1 key={lineIdx} className="vscode-chat-h1">{renderInlineFormatting(line.slice(2))}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={lineIdx} className="vscode-chat-h2">{renderInlineFormatting(line.slice(3))}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={lineIdx} className="vscode-chat-h3">{renderInlineFormatting(line.slice(4))}</h3>;
        }
        
        // 处理无序列表
        if (line.match(/^[\-\*]\s/)) {
          return <li key={lineIdx} className="vscode-chat-li">{renderInlineFormatting(line.slice(2))}</li>;
        }
        
        // 处理有序列表
        if (line.match(/^\d+\.\s/)) {
          const match = line.match(/^(\d+)\.\s(.*)$/);
          if (match) {
            return (
              <li key={lineIdx} className="vscode-chat-li" style={{ listStyleType: 'decimal' }}>
                {renderInlineFormatting(match[2])}
              </li>
            );
          }
        }
        
        // 处理引用
        if (line.startsWith('> ')) {
          return <blockquote key={lineIdx} className="vscode-chat-blockquote">{renderInlineFormatting(line.slice(2))}</blockquote>;
        }
        
        // 处理水平线
        if (line.match(/^[\-\*]{3,}$/)) {
          return <hr key={lineIdx} className="vscode-chat-hr" />;
        }
        
        // 跳过空白行但保留间距
        if (!line.trim()) {
          return <div key={lineIdx} className="vscode-chat-empty-line">&nbsp;</div>;
        }
        
        // 普通段落
        return <p key={lineIdx} className="vscode-chat-p">{renderInlineFormatting(line)}</p>;
      })}
    </>
  );
}

// 渲染代码块
function renderCodeBlock(language: string, code: string): React.ReactNode {
  // 简单的语法高亮 - 实际应使用 Prism 等库
  const highlightedCode = highlightSyntax(code, language);
  
  return (
    <div className="vscode-chat-code-block">
      <div className="vscode-chat-code-header">
        <span className="vscode-chat-code-language">{language}</span>
        <button 
          className="vscode-chat-code-copy"
          onClick={() => navigator.clipboard.writeText(code)}
          title="复制代码"
        >
          复制
        </button>
      </div>
      <pre className="vscode-chat-code-pre">
        <code 
          className={`vscode-chat-code language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </pre>
    </div>
  );
}

// 简单的语法高亮
function highlightSyntax(code: string, language: string): string {
  if (!code) return '';
  
  let result = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // 关键字高亮
  const keywords: Record<string, string[]> = {
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof'],
    typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'extends', 'public', 'private', 'protected', 'readonly'],
    python: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'global', 'nonlocal', 'pass', 'break', 'continue', 'raise', 'assert', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'],
    css: ['@media', '@import', '@keyframes', '@font-face', 'important', 'inherit', 'initial', 'unset', 'none', 'block', 'inline', 'flex', 'grid'],
    html: ['DOCTYPE', 'html', 'head', 'body', 'div', 'span', 'script', 'style', 'link', 'meta', 'title', 'header', 'footer', 'nav', 'main', 'section', 'article', 'aside'],
    json: ['true', 'false', 'null'],
  };
  
  const langKeywords = keywords[language] || keywords['javascript'] || [];
  
  // 字符串高亮
  result = result.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, '<span class="vscode-string">$&</span>');
  
  // 注释高亮
  if (['javascript', 'typescript', 'css', 'html'].includes(language)) {
    result = result.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span class="vscode-comment">$&</span>');
  }
  if (language === 'python') {
    result = result.replace(/(#.*$)/gm, '<span class="vscode-comment">$&</span>');
  }
  
  // 数字高亮
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="vscode-number">$1</span>');
  
  // 关键字高亮
  for (const keyword of langKeywords) {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'g');
    result = result.replace(regex, '<span class="vscode-keyword">$1</span>');
  }
  
  // URL 高亮
  result = result.replace(/(https?:\/\/[^\s<>"]+)/g, '<span class="vscode-url">$1</span>');
  
  return result;
}

// MarkdownRenderer 组件
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const rendered = useMemo(() => {
    if (!content) return null;
    
    const parts = parseCodeBlocks(content);
    
    return parts.map((part, idx) => {
      if (part.type === 'code') {
        return renderCodeBlock(part.language || 'plaintext', part.content);
      }
      return (
        <div key={idx} className="vscode-chat-markdown-text">
          {renderText(part.content)}
        </div>
      );
    });
  }, [content]);
  
  return (
    <div className={`vscode-chat-markdown ${className}`}>
      {rendered}
    </div>
  );
}

export default MarkdownRenderer;
