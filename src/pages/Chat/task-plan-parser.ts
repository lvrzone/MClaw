/**
 * Task Plan Parser - 任务计划解析器
 * 从AI响应中提取结构化任务分解
 */
import { TaskPlanStep, TaskPhase } from './TaskPlanPanel';

/**
 * 从文本中提取任务计划
 */
export function parseTaskPlanFromText(text: string): TaskPlanStep[] {
  const steps: TaskPlanStep[] = [];
  
  // 匹配模式1: "1. 步骤名称" 或 "1. 🔍 步骤名称"
  const numberedPattern = /^(\d+)\.\s*(?:[^\w]*\s*)?(\*\*)?([^*:]+?)(?:\*\*)?[:：]?\s*(.*)$/gm;
  
  // 匹配模式2: "- 步骤名称" 或 "- 🔍 步骤名称"
  const bulletPattern = /^-\s*(?:[^\w]*\s*)?(\*\*)?([^*:]+?)(?:\*\*)?[:：]?\s*(.*)$/gm;
  
  let match;
  let stepIndex = 0;
  
  // 尝试匹配带编号的步骤
  while ((match = numberedPattern.exec(text)) !== null) {
    const [, , label, detail] = match;
    if (label && !label.includes('任务计划') && !label.includes('目标')) {
      steps.push({
        id: `parsed-${stepIndex}`,
        label: label.trim(),
        status: 'pending',
        detail: detail?.trim() || undefined,
      });
      stepIndex++;
    }
  }
  
  // 尝试匹配带圆点的步骤
  while ((match = bulletPattern.exec(text)) !== null) {
    const [, , label, detail] = match;
    if (label && !steps.some(s => s.label === label.trim())) {
      steps.push({
        id: `parsed-${stepIndex}`,
        label: label.trim(),
        status: 'pending',
        detail: detail?.trim() || undefined,
      });
      stepIndex++;
    }
  }
  
  return steps;
}

/**
 * 从工具调用名称推断任务阶段
 */
export function inferPhaseFromTool(toolName: string): TaskPhase {
  const name = toolName.toLowerCase();
  
  if (name.includes('search') || name.includes('find') || name.includes('read') || name.includes('analyze')) {
    return 'analyzing';
  }
  if (name.includes('write') || name.includes('create') || name.includes('config')) {
    return 'planning';
  }
  if (name.includes('execute') || name.includes('run') || name.includes('build') || name.includes('code')) {
    return 'executing';
  }
  if (name.includes('test') || name.includes('verify') || name.includes('check')) {
    return 'verifying';
  }
  
  return 'executing';
}

/**
 * 解析阶段标签
 */
export function parsePhaseLabel(text: string): { phase: TaskPhase; label: string } | null {
  const lower = text.toLowerCase();
  
  const phaseMap: Record<string, TaskPhase> = {
    '分析': 'analyzing',
    'analyzing': 'analyzing',
    'analysis': 'analyzing',
    '规划': 'planning',
    'planning': 'planning',
    'plan': 'planning',
    '执行': 'executing',
    'executing': 'executing',
    'execute': 'executing',
    '验证': 'verifying',
    'verifying': 'verifying',
    'verify': 'verifying',
    '完成': 'done',
    'done': 'done',
  };
  
  for (const [key, phase] of Object.entries(phaseMap)) {
    if (lower.includes(key)) {
      return { phase, label: text.trim() };
    }
  }
  
  return null;
}

/**
 * 格式化步骤时间
 */
export function formatStepDuration(startTime?: number, endTime?: number): string {
  if (!startTime) return '';
  
  const end = endTime || Date.now();
  const duration = end - startTime;
  
  if (duration < 1000) return `${duration}ms`;
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
  return `${(duration / 60000).toFixed(1)}m`;
}

/**
 * 增强的任务步骤推断
 */
export function enhanceTaskSteps(
  tools: Array<{ name: string; input?: Record<string, unknown> }>,
  completedTools: Array<{ name: string; summary?: string }>,
  streamText?: string
): TaskPlanStep[] {
  const steps: TaskPlanStep[] = [];
  const seenIds = new Set<string>();

  // 如果有流式文本，尝试从中提取任务计划
  if (streamText) {
    const parsedSteps = parseTaskPlanFromText(streamText);
    if (parsedSteps.length > 0) {
      return parsedSteps;
    }
  }

  // 添加已完成工具
  completedTools.forEach((tool, idx) => {
    const id = `completed-${tool.name}-${idx}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);
    
    steps.push({
      id,
      label: formatToolName(tool.name),
      status: 'completed',
      detail: tool.summary,
      phase: inferPhaseFromTool(tool.name),
    });
  });

  // 添加正在运行的工具
  tools.forEach((tool, idx) => {
    const id = `running-${tool.name}-${idx}`;
    if (seenIds.has(id)) return;
    seenIds.add(id);

    const alreadyCompleted = completedTools.some((ct, ci) => 
      `completed-${ct.name}-${ci}` === id
    );
    if (alreadyCompleted) return;

    steps.push({
      id,
      label: formatToolName(tool.name),
      status: 'running',
      phase: inferPhaseFromTool(tool.name),
    });
  });

  return steps;
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}
