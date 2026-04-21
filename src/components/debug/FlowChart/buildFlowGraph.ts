/**
 * Build Flow Graph - Convert flat event list into a tree structure
 *
 * Algorithm reference: vscode-main/src/vs/workbench/contrib/chat/browser/chatDebug/chatDebugFlowGraph.ts
 */

import type { FlowNode, FlowNodeKind, FlowFilterOptions } from './types';

/** Input event format */
export interface FlowEvent {
  id: string;
  kind: string;
  label: string;
  parentId?: string;
  timestamp?: number;
  isError?: boolean;
  detail?: string;
}

/**
 * Truncates a string to a max length, appending an ellipsis if trimmed.
 */
function truncateLabel(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 1) + '…';
}

/**
 * Map event kind to FlowNodeKind
 */
function mapKind(kind: string): FlowNodeKind {
  const normalized = kind.toLowerCase().replace(/[-_\s]+/g, '');
  
  // User message
  if (['usermessage', 'user', 'userprompt'].includes(normalized)) {
    return 'user';
  }
  
  // Agent/subagent
  if (['agent', 'subagent', 'subagentinvocation', 'agentresponse'].includes(normalized)) {
    return 'agent';
  }
  
  // Tool call
  if (['tool', 'toolcall', 'tool_use', 'tooluse'].includes(normalized)) {
    return 'tool';
  }
  
  // Thinking
  if (['thinking', 'think', 'reasoning', 'reason'].includes(normalized)) {
    return 'thinking';
  }
  
  // Error
  if (['error', 'failed', 'failure'].includes(normalized)) {
    return 'error';
  }
  
  // System
  if (['system', 'modelturn', 'model', 'generic'].includes(normalized)) {
    return 'system';
  }
  
  return 'system';
}

/**
 * Build a tooltip from event data
 */
function buildTooltip(event: FlowEvent): string | undefined {
  const parts: string[] = [event.label];
  
  if (event.detail) {
    parts.push(event.detail);
  }
  
  if (event.timestamp) {
    const date = new Date(event.timestamp);
    parts.push(`Time: ${date.toLocaleTimeString()}`);
  }
  
  return parts.join('\n');
}

/**
 * Build a tree of FlowNodes from a flat list of events.
 * Events are linked via parentId.
 */
export function buildFlowGraph(events: readonly FlowEvent[]): FlowNode[] {
  if (events.length === 0) {
    return [];
  }

  // Index events by ID
  const idToEvent = new Map<string, FlowEvent>();
  const idToChildren = new Map<string, FlowEvent[]>();
  const roots: FlowEvent[] = [];

  for (const event of events) {
    idToEvent.set(event.id, event);
  }

  for (const event of events) {
    if (event.parentId && idToEvent.has(event.parentId)) {
      let children = idToChildren.get(event.parentId);
      if (!children) {
        children = [];
        idToChildren.set(event.parentId, children);
      }
      children.push(event);
    } else {
      roots.push(event);
    }
  }

  // Sort roots and children by timestamp
  const sortByTime = (a: FlowEvent, b: FlowEvent) => 
    (a.timestamp ?? 0) - (b.timestamp ?? 0);
  
  roots.sort(sortByTime);
  for (const children of idToChildren.values()) {
    children.sort(sortByTime);
  }

  // Convert events to FlowNodes recursively
  function toFlowNode(event: FlowEvent): FlowNode {
    const children = event.id ? idToChildren.get(event.id) : undefined;
    const kind = mapKind(event.kind);
    
    // Build sublabel from timestamp or detail
    let sublabel: string | undefined;
    if (event.timestamp) {
      const date = new Date(event.timestamp);
      sublabel = date.toLocaleTimeString();
    }
    if (event.detail && event.detail.length < 60) {
      sublabel = event.detail;
    }

    return {
      id: event.id,
      kind,
      label: truncateLabel(event.label, 30),
      sublabel,
      tooltip: buildTooltip(event),
      isError: event.isError ?? kind === 'error',
      timestamp: event.timestamp,
      children: children?.map(toFlowNode) ?? [],
    };
  }

  const rawNodes = roots.map(toFlowNode);

  // Post-process: merge consecutive same-kind nodes
  return mergeConsecutiveNodes(rawNodes);
}

/**
 * Merge consecutive nodes of the same kind (e.g., multiple thinking steps)
 * into a single summary node.
 */
function mergeConsecutiveNodes(nodes: FlowNode[]): FlowNode[] {
  const result: FlowNode[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i];

    // Only merge thinking and tool nodes
    if (node.kind !== 'thinking' && node.kind !== 'tool') {
      const mergedChildren = mergeConsecutiveNodes(node.children);
      result.push(mergedChildren !== node.children 
        ? { ...node, children: mergedChildren } 
        : node);
      i++;
      continue;
    }

    // Accumulate consecutive nodes of the same kind
    const run: FlowNode[] = [node];
    let j = i + 1;
    while (j < nodes.length && nodes[j].kind === node.kind) {
      run.push(nodes[j]);
      j++;
    }

    if (run.length < 2) {
      // Single node — recurse into children
      const mergedChildren = mergeConsecutiveNodes(node.children);
      result.push(mergedChildren !== node.children 
        ? { ...node, children: mergedChildren } 
        : node);
      i = j;
      continue;
    }

    // Build merged summary node
    const mergedId = `merged-${node.kind}:${run[0].id}`;
    const labels = [...new Set(run.map(n => n.label))];
    const summaryLabel = labels.length <= 2
      ? labels.join(', ')
      : `${labels[0]} +${run.length - 1} more`;

    result.push({
      id: mergedId,
      kind: node.kind,
      label: node.kind === 'thinking' 
        ? `${run.length} thinking steps` 
        : summaryLabel,
      sublabel: `${run.length} ${node.kind}${run.length > 1 ? 's' : ''}`,
      tooltip: run.map(n => n.label + (n.sublabel ? `: ${n.sublabel}` : '')).join('\n'),
      timestamp: run[0].timestamp,
      children: [],
      mergedNodes: run,
    });
    i = j;
  }

  return result;
}

/**
 * Filter a flow node tree by kind visibility and text search.
 * Returns a new tree — the input is not mutated.
 */
export function filterFlowNodes(nodes: FlowNode[], options: FlowFilterOptions): FlowNode[] {
  let result = filterByKind(nodes, options.isKindVisible);
  if (options.textFilter) {
    result = filterByText(result, options.textFilter);
  }
  return result;
}

function filterByKind(
  nodes: FlowNode[], 
  isKindVisible: (kind: string) => boolean
): FlowNode[] {
  const result: FlowNode[] = [];
  let changed = false;

  for (const node of nodes) {
    if (!isKindVisible(node.kind)) {
      changed = true;
      // For agents, drop the entire subgraph
      if (node.kind === 'agent') {
        continue;
      }
      // For other kinds, re-parent children up
      result.push(...filterByKind(node.children, isKindVisible));
      continue;
    }

    const filteredChildren = filterByKind(node.children, isKindVisible);
    if (filteredChildren !== node.children) {
      changed = true;
      result.push({ ...node, children: filteredChildren });
    } else {
      result.push(node);
    }
  }

  return changed ? result : nodes;
}

function nodeMatchesText(node: FlowNode, text: string): boolean {
  const lowerText = text.toLowerCase();
  return node.label.toLowerCase().includes(lowerText) ||
    (node.sublabel?.toLowerCase().includes(lowerText) ?? false) ||
    (node.tooltip?.toLowerCase().includes(lowerText) ?? false);
}

function filterByText(nodes: FlowNode[], text: string): FlowNode[] {
  const result: FlowNode[] = [];

  for (const node of nodes) {
    if (nodeMatchesText(node, text)) {
      // Node matches — keep it with all descendants
      result.push(node);
      continue;
    }

    // Check if any descendant matches
    const filteredChildren = filterByText(node.children, text);
    if (filteredChildren.length > 0) {
      // Keep this node as an ancestor of matching descendants
      result.push({ ...node, children: filteredChildren });
    }
  }

  return result;
}

/**
 * Counts the total number of nodes in a tree (each node + all descendants).
 */
function countNodes(nodes: readonly FlowNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1 + countNodes(node.children);
  }
  return count;
}

export interface FlowSliceResult {
  nodes: FlowNode[];
  totalCount: number;
  shownCount: number;
}

/**
 * Slices a flow node tree to at most maxCount nodes (pre-order DFS).
 */
export function sliceFlowNodes(nodes: readonly FlowNode[], maxCount: number): FlowSliceResult {
  const totalCount = countNodes(nodes);
  if (totalCount <= maxCount) {
    return { nodes: nodes as FlowNode[], totalCount, shownCount: totalCount };
  }

  let remaining = maxCount;

  function sliceTree(nodeList: readonly FlowNode[]): FlowNode[] {
    const result: FlowNode[] = [];
    for (const node of nodeList) {
      if (remaining <= 0) break;
      remaining--;
      
      if (node.children.length === 0 || remaining <= 0) {
        result.push(node.children.length === 0 ? node : { ...node, children: [] });
      } else {
        const slicedChildren = sliceTree(node.children);
        result.push(slicedChildren !== node.children 
          ? { ...node, children: slicedChildren } 
          : node);
      }
    }
    return result;
  }

  const sliced = sliceTree(nodes);
  const shownCount = maxCount - remaining;
  return { nodes: sliced, totalCount, shownCount };
}
