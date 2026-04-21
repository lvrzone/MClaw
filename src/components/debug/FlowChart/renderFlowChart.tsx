/**
 * Render Flow Chart - React component for rendering the flow visualization
 */

import React, { memo, useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { FlowNode } from './types';
import { buildFlowGraph } from './buildFlowGraph';
import { layoutFlowGraph } from './layoutFlowGraph';
import type { LayoutNode, LayoutEdge, SubgraphRect } from './types';

interface FlowChartProps {
  events: Array<{
    id: string;
    kind: string;
    category?: string;
    label: string;
    sublabel?: string;
    description?: string;
    timestamp?: number;
    isError?: boolean;
    parentId?: string;
    children?: Array<unknown>;
  }>;
  width?: number;
  height?: number;
  filterText?: string;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

// Color mapping for different node kinds
const KIND_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  tool: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },      // blue
  error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },     // red
  discovery: { bg: '#dcfce7', border: '#22c55e', text: '#166534' }, // green
  generic: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },   // gray
  agent: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },     // amber
  thinking: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },  // purple
  user: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0c4a6e' },      // sky
  system: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },    // gray
};

function getNodeColors(kind: string): { bg: string; border: string; text: string } {
  const normalized = kind.toLowerCase();
  if (normalized.includes('tool')) return KIND_COLORS.tool;
  if (normalized.includes('error')) return KIND_COLORS.error;
  if (normalized.includes('discovery')) return KIND_COLORS.discovery;
  if (normalized.includes('agent')) return KIND_COLORS.agent;
  if (normalized.includes('think')) return KIND_COLORS.thinking;
  if (normalized.includes('user')) return KIND_COLORS.user;
  if (normalized.includes('system')) return KIND_COLORS.system;
  return KIND_COLORS.generic;
}

/**
 * Create a bezier curve path from source to target
 */
function createEdgePath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midY = (fromY + toY) / 2;
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

export const FlowChart = memo(function FlowChart({
  events,
  width = 800,
  height = 600,
  filterText,
  onNodeClick,
  className,
}: FlowChartProps) {
  // Transform events to FlowNode tree
  const flowNodes = useMemo(() => {
    const flowEvents = events.map(e => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      parentId: e.parentId,
      timestamp: e.timestamp,
      isError: e.isError,
      detail: e.description,
    }));
    return buildFlowGraph(flowEvents);
  }, [events]);

  // Filter nodes based on filterText
  const filteredNodes = useMemo(() => {
    if (!filterText || filterText.trim() === '') {
      return flowNodes;
    }
    
    const lowerFilter = filterText.toLowerCase();
    
    function filterNodeTree(nodes: FlowNode[]): FlowNode[] {
      const result: FlowNode[] = [];
      
      for (const node of nodes) {
        const matches = 
          node.label.toLowerCase().includes(lowerFilter) ||
          node.kind.toLowerCase().includes(lowerFilter) ||
          (node.sublabel?.toLowerCase().includes(lowerFilter) ?? false);
        
        const filteredChildren = filterNodeTree(node.children);
        
        if (matches || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
          });
        }
      }
      
      return result;
    }
    
    return filterNodeTree(flowNodes);
  }, [flowNodes, filterText]);

  // Compute layout
  const layout = useMemo(() => {
    return layoutFlowGraph(filteredNodes);
  }, [filteredNodes]);

  // Viewport state for pan and zoom
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Center the view initially
  useEffect(() => {
    if (layout.width > 0 && layout.height > 0) {
      const scaleX = (width - 40) / layout.width;
      const scaleY = (height - 40) / layout.height;
      const zoom = Math.min(scaleX, scaleY, 1);
      const x = (width - layout.width * zoom) / 2;
      const y = 20;
      setViewport({ x, y, zoom });
    }
  }, [layout.width, layout.height, width, height]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport(prev => ({
      ...prev,
      zoom: Math.max(0.1, Math.min(3, prev.zoom * delta)),
    }));
  }, []);

  // Handle mouse down for pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    }
  }, [viewport.x, viewport.y]);

  // Handle mouse move for pan
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setViewport(prev => ({
        ...prev,
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      }));
    }
  }, [isDragging]);

  // Handle mouse up to end pan
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId);
    }
  }, [onNodeClick]);

  // Render subgraph rectangles
  const renderSubgraphs = (subgraphs: SubgraphRect[]) => {
    return subgraphs.map((subgraph, index) => (
      <g key={`subgraph-${subgraph.nodeId}-${index}`}>
        <rect
          x={subgraph.x}
          y={subgraph.y}
          width={subgraph.width}
          height={subgraph.height}
          fill="none"
          stroke="#9ca3af"
          strokeWidth={1}
          strokeDasharray="4,4"
          rx={4}
        />
        {subgraph.label && (
          <text
            x={subgraph.x + 8}
            y={subgraph.y + 14}
            fontSize={10}
            fill="#6b7280"
            fontWeight={500}
          >
            {subgraph.label}
          </text>
        )}
      </g>
    ));
  };

  // Render edges
  const renderEdges = (edges: LayoutEdge[]) => {
    return edges.map((edge, index) => {
      const path = createEdgePath(edge.fromX, edge.fromY, edge.toX, edge.toY);
      return (
        <g key={`edge-${index}`}>
          <path
            d={path}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.5}
          />
          {/* Arrow marker */}
          <polygon
            points={`${edge.toX},${edge.toY} ${edge.toX - 4},${edge.toY - 8} ${edge.toX + 4},${edge.toY - 8}`}
            fill="#9ca3af"
          />
        </g>
      );
    });
  };

  // Render nodes
  const renderNodes = (nodes: LayoutNode[]) => {
    return nodes.map(node => {
      const colors = getNodeColors(node.kind);
      const isError = node.isError;
      
      return (
        <g
          key={`node-${node.id}`}
          transform={`translate(${node.x}, ${node.y})`}
          onClick={() => handleNodeClick(node.id)}
          style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
        >
          <rect
            width={node.width}
            height={node.height}
            rx={6}
            fill={isError ? KIND_COLORS.error.bg : colors.bg}
            stroke={isError ? KIND_COLORS.error.border : colors.border}
            strokeWidth={isError ? 2 : 1}
          />
          <text
            x={node.width / 2}
            y={20}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill={isError ? KIND_COLORS.error.text : colors.text}
          >
            {node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label}
          </text>
          {node.sublabel && (
            <text
              x={node.width / 2}
              y={36}
              textAnchor="middle"
              fontSize={10}
              fill={isError ? KIND_COLORS.error.text : colors.text}
              opacity={0.8}
            >
              {node.sublabel.length > 25 ? node.sublabel.slice(0, 24) + '…' : node.sublabel}
            </text>
          )}
          {node.mergedCount && node.mergedCount > 1 && (
            <circle
              cx={node.width - 8}
              cy={8}
              r={8}
              fill={colors.border}
            />
          )}
          {node.mergedCount && node.mergedCount > 1 && (
            <text
              x={node.width - 8}
              y={11}
              textAnchor="middle"
              fontSize={8}
              fill="white"
              fontWeight={600}
            >
              {node.mergedCount}
            </text>
          )}
        </g>
      );
    });
  };

  return (
    <div
      className={className}
      style={{
        width,
        height,
        overflow: 'hidden',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        backgroundColor: '#fafafa',
      }}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {/* Render subgraphs first (behind nodes) */}
          {renderSubgraphs(layout.subgraphs)}
          
          {/* Render edges */}
          {renderEdges(layout.edges)}
          
          {/* Render nodes */}
          {renderNodes(layout.nodes)}
        </g>
      </svg>
      
      {/* Zoom controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          display: 'flex',
          gap: 4,
          backgroundColor: 'white',
          borderRadius: 4,
          padding: 4,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <button
          onClick={() => setViewport(prev => ({ ...prev, zoom: Math.max(0.1, prev.zoom * 0.9) }))}
          style={{
            width: 28,
            height: 28,
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
            color: '#374151',
          }}
        >
          −
        </button>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            fontSize: 12,
            color: '#6b7280',
            minWidth: 48,
            justifyContent: 'center',
          }}
        >
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          onClick={() => setViewport(prev => ({ ...prev, zoom: Math.min(3, prev.zoom * 1.1) }))}
          style={{
            width: 28,
            height: 28,
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            backgroundColor: 'white',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
            color: '#374151',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
});
