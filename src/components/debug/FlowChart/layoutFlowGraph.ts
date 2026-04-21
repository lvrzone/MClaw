/**
 * Layout Flow Graph - Compute node positions using a simplified Sugiyama-style layout
 */

import type { FlowNode, LayoutNode, LayoutEdge, SubgraphRect, FlowLayout } from './types';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 48;
const LAYER_GAP = 60;
const NODE_GAP = 24;
const SUBGRAPH_PADDING = 16;

/**
 * Build a map of node IDs to their parent IDs for edge calculation
 */
function buildParentMap(nodes: FlowNode[]): Map<string, string> {
  const parentMap = new Map<string, string>();
  
  function traverse(node: FlowNode, parentId?: string) {
    if (parentId) {
      parentMap.set(node.id, parentId);
    }
    for (const child of node.children) {
      traverse(child, node.id);
    }
  }
  
  for (const node of nodes) {
    traverse(node);
  }
  
  return parentMap;
}

/**
 * Collect all nodes into layers using BFS from roots
 */
function buildLayers(nodes: FlowNode[]): FlowNode[][] {
  const layers: FlowNode[][] = [];
  const visited = new Set<string>();
  
  // First layer: root nodes (no parent)
  const roots = nodes.filter(n => !n.id.includes(':')) || nodes;
  if (roots.length === 0) return layers;
  
  let currentLayer = [...roots];
  
  while (currentLayer.length > 0) {
    // Add current layer
    layers.push(currentLayer);
    
    // Collect children for next layer
    const nextLayer: FlowNode[] = [];
    for (const node of currentLayer) {
      if (!visited.has(node.id)) {
        visited.add(node.id);
        for (const child of node.children) {
          if (!visited.has(child.id)) {
            nextLayer.push(child);
          }
        }
      }
    }
    currentLayer = nextLayer;
  }
  
  return layers;
}

/**
 * Calculate the bounding box of a set of layout nodes
 */
function calculateBounds(layoutNodes: LayoutNode[]): { minX: number; maxX: number; minY: number; maxY: number } {
  if (layoutNodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  for (const node of layoutNodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + node.width);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + node.height);
  }
  
  return { minX, maxX, minY, maxY };
}

/**
 * Compute layout positions for all nodes
 */
export function layoutFlowGraph(nodes: FlowNode[]): FlowLayout {
  if (nodes.length === 0) {
    return { nodes: [], edges: [], subgraphs: [], width: 0, height: 0 };
  }
  
  const parentMap = buildParentMap(nodes);
  const layers = buildLayers(nodes);
  
  // Map from node ID to layout node
  const layoutNodeMap = new Map<string, LayoutNode>();
  const layoutNodes: LayoutNode[] = [];
  
  // Assign positions layer by layer
  let currentY = SUBGRAPH_PADDING;
  
  for (const layer of layers) {
    // Sort nodes within layer by their original order (timestamp or ID)
    layer.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      return a.id.localeCompare(b.id);
    });
    
    // Calculate total width of this layer
    let currentX = SUBGRAPH_PADDING;
    
    // Center the layer horizontally (we'll adjust later based on overall bounds)
    for (let i = 0; i < layer.length; i++) {
      const node = layer[i];
      const layoutNode: LayoutNode = {
        id: node.id,
        kind: node.kind,
        label: node.label,
        sublabel: node.sublabel,
        tooltip: node.tooltip,
        isError: node.isError,
        x: currentX,
        y: currentY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        mergedCount: node.mergedNodes?.length,
      };
      
      layoutNodeMap.set(node.id, layoutNode);
      layoutNodes.push(layoutNode);
      
      currentX += NODE_WIDTH + NODE_GAP;
    }
    
    currentY += NODE_HEIGHT + LAYER_GAP;
  }
  
  // Center all layers horizontally relative to each other
  const layerWidths = layers.map(layer => 
    layer.length * NODE_WIDTH + (layer.length - 1) * NODE_GAP
  );
  const maxLayerWidth = Math.max(...layerWidths, 0);
  
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const layerWidth = layerWidths[i];
    const offsetX = (maxLayerWidth - layerWidth) / 2;
    
    for (const node of layer) {
      const layoutNode = layoutNodeMap.get(node.id);
      if (layoutNode) {
        layoutNode.x += offsetX;
      }
    }
  }
  
  // Build edges
  const edges: LayoutEdge[] = [];
  
  for (const layoutNode of layoutNodes) {
    const parentId = parentMap.get(layoutNode.id);
    if (parentId) {
      const parentNode = layoutNodeMap.get(parentId);
      if (parentNode) {
        edges.push({
          fromId: parentId,
          toId: layoutNode.id,
          fromX: parentNode.x + parentNode.width / 2,
          fromY: parentNode.y + parentNode.height,
          toX: layoutNode.x + layoutNode.width / 2,
          toY: layoutNode.y,
        });
      }
    }
  }
  
  // Build subgraphs for nodes with children
  const subgraphs: SubgraphRect[] = [];
  
  function buildSubgraph(node: FlowNode, depth: number): void {
    if (node.children.length > 0) {
      // Find all descendant layout nodes
      const descendantIds = new Set<string>();
      
      function collectDescendants(n: FlowNode) {
        descendantIds.add(n.id);
        for (const child of n.children) {
          collectDescendants(child);
        }
      }
      collectDescendants(node);
      
      // Get layout nodes for descendants
      const descendantLayoutNodes = layoutNodes.filter(n => descendantIds.has(n.id));
      
      if (descendantLayoutNodes.length > 0) {
        const bounds = calculateBounds(descendantLayoutNodes);
        
        subgraphs.push({
          label: node.label,
          x: bounds.minX - SUBGRAPH_PADDING,
          y: bounds.minY - SUBGRAPH_PADDING,
          width: bounds.maxX - bounds.minX + SUBGRAPH_PADDING * 2,
          height: bounds.maxY - bounds.minY + SUBGRAPH_PADDING * 2,
          depth,
          nodeId: node.id,
          collapsedChildCount: node.children.length,
        });
      }
      
      // Recurse into children
      for (const child of node.children) {
        buildSubgraph(child, depth + 1);
      }
    }
  }
  
  for (const node of nodes) {
    buildSubgraph(node, 0);
  }
  
  // Calculate total dimensions
  const bounds = calculateBounds(layoutNodes);
  const width = Math.max(bounds.maxX + SUBGRAPH_PADDING, maxLayerWidth + SUBGRAPH_PADDING * 2);
  const height = bounds.maxY + SUBGRAPH_PADDING;
  
  return {
    nodes: layoutNodes,
    edges,
    subgraphs,
    width,
    height,
  };
}
