/**
 * VSCodeChat 模块导出
 * 移植自 VS Code Chat
 */

// 主组件
export { VSCodeChat } from './components/VSCodeChat';
export { ChatMessageItem } from './components/ChatMessageItem';
export { ChatResponseList } from './components/ChatResponseList';
export { ChatInput } from './components/ChatInput';
export { MarkdownRenderer } from './components/MarkdownRenderer';
export { ToolCall } from './components/ToolCall';
export { Confirmation } from './components/Confirmation';
export { ChatAttachments } from './components/ChatAttachments';
export { ChatQuotaWidget } from './components/ChatQuotaWidget';
export { ChatModelPicker } from './components/ChatModelPicker';

// 类型
export * from './types/chat';

// 样式 (在使用的组件中直接 import './styles/chat.css')
