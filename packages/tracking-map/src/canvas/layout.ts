import Dagre from '@dagrejs/dagre';
import type { Edge, Node } from '@xyflow/react';

/**
 * Auto-layout the map using dagre. Call from the "Arrange" toolbar
 * button; returns a new `{ nodes, edges }` pair with updated positions.
 * Does not mutate the input arrays.
 *
 * Direction defaults to left-to-right because tracking flows read that
 * way (site → pixel → ad account → conversion).
 */
export function autoLayout<TData extends Record<string, unknown>>(
  nodes: Node<TData>[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR',
): { nodes: Node<TData>[]; edges: Edge[] } {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });

  for (const n of nodes) {
    g.setNode(n.id, {
      width: n.measured?.width ?? 220,
      height: n.measured?.height ?? 80,
    });
  }
  for (const e of edges) {
    g.setEdge(e.source, e.target);
  }

  Dagre.layout(g);

  const laidOut = nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: {
        x: pos.x - (n.measured?.width ?? 220) / 2,
        y: pos.y - (n.measured?.height ?? 80) / 2,
      },
    };
  });

  return { nodes: laidOut, edges };
}
