/**
 * FlowChart Types - Core data structures for the Agent execution flow visualization
 */

export type FlowNodeKind = 'agent' | 'tool' | 'thinking' | 'error' | 'user' | 'system';

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  label: string;
  sublabel?: string;
  tooltip?: string;
  isError?: boolean;
  children: FlowNode[];
  /** Timestamp for sorting and display */
  timestamp?: number;
  /** Present on merged nodes: the individual nodes that were merged */
  mergedNodes?: FlowNode[];
}

export interface LayoutNode {
  id: string;
  kind: FlowNodeKind;
  label: string;
  sublabel?: string;
  tooltip?: string;
  isError?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Number of individual nodes merged into this one */
  mergedCount?: number;
  /** Whether the merged node is currently expanded */
  isMergedExpanded?: boolean;
}

export interface LayoutEdge {
  fromId?: string;
  toId?: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface SubgraphRect {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
  nodeId: string;
  collapsedChildCount?: number;
}

export interface FlowLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  subgraphs: SubgraphRect[];
  width: number;
  height: number;
}

export interface FlowChartProps {
  events: Array<{
    id: string;
    kind: string;
    label: string;
    parentId?: string;
    timestamp?: number;
    isError?: boolean;
    detail?: string;
  }>;
  activeNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
  /** Maximum number of nodes to show (for performance) */
  maxNodes?: number;
}

export interface FlowFilterOptions {
  isKindVisible: (kind: string) => boolean;
  textFilter: string;
}
