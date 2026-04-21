/**
 * MarkdownRenderer - Markdown 内容渲染组件（高级版）
 * 对齐 VS Code chatMarkdownContentPart.ts
 *
 * 特性：
 * - react-markdown 解析
 * - shiki 语法高亮（30+ 常见语言）
 * - remark-gfm 表格/任务列表/删除线
 * - 链接/图片安全处理
 * - 代码复制按钮
 */
import { useCallback, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createHighlighter, type Highlighter } from 'shiki';
import { Copy, Check, ExternalLink } from 'lucide-react';

// ============ Props ============
interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// ============ 单例 Highlighter ============
let highlighterInstance: Highlighter | null = null;
let highlighterPromise: Promise<Highlighter> | null = null;

function getShikiHighlighter(): Promise<Highlighter> {
  if (highlighterInstance) return Promise.resolve(highlighterInstance);
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: [
        'javascript', 'typescript', 'python', 'go', 'rust', 'java',
        'c', 'cpp', 'csharp', 'php', 'ruby', 'swift', 'kotlin',
        'html', 'css', 'scss', 'json', 'yaml', 'toml', 'xml',
        'sql', 'bash', 'sh', 'powershell', 'dockerfile',
        'markdown', 'diff', 'plaintext',
      ],
    }).then((h) => {
      highlighterInstance = h;
      return h;
    });
  }
  return highlighterPromise;
}

// ============ 代码块（异步渲染） ============
interface CodeBlockProps {
  code: string;
  language: string;
}

function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [html, setHtml] = useState<string>('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const lang = language && language !== 'plaintext' ? language : 'plaintext';

    getShikiHighlighter()
      .then((h) => {
        if (cancelled) return;
        try {
          const highlighted = h.codeToHtml(code, { lang, theme: 'github-dark' });
          setHtml(highlighted);
        } catch {
          if (!cancelled) setHtml(`<pre><code>${code}</code></pre>`);
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(`<pre><code>${code}</code></pre>`);
      });

    return () => { cancelled = true; };
  }, [code, language]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <div className="vscode-chat-code-block">
      <div className="vscode-chat-code-header">
        <span className="vscode-chat-code-language">{language || 'code'}</span>
        <button className="vscode-chat-code-copy" onClick={handleCopy} title="复制代码">
          {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
      </div>
      <div className="vscode-chat-code-pre" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ============ 主组件 ============
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`vscode-chat-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块
          code({ className: codeClassName, children }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const isInline = !match && !String(children).includes('\n');
            const code = String(children).replace(/\n$/, '');

            if (isInline) {
              return <code className="vscode-inline-code">{children}</code>;
            }
            return <CodeBlock code={code} language={match ? match[1] : 'plaintext'} />;
          },

          // 链接
          a({ href, children, ...props }) {
            const isExternal = typeof href === 'string' && (href.startsWith('http://') || href.startsWith('https://'));
            return (
              <a
                href={href as string}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="vscode-chat-link"
                {...(props as object)}
              >
                {children}
                {isExternal && <ExternalLink size={10} className="vscode-chat-link-icon" />}
              </a>
            );
          },

          // 图片
          img({ src, alt }) {
            return (
              <img
                src={src as string}
                alt={alt as string}
                className="vscode-chat-markdown-image"
                loading="lazy"
              />
            );
          },

          // 引用
          blockquote({ children }) {
            return <blockquote className="vscode-chat-blockquote">{children}</blockquote>;
          },

          // 表格
          table({ children }) {
            return (
              <div className="vscode-chat-table-wrapper">
                <table className="vscode-chat-table">{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
