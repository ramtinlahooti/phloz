'use client';

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  useReactFlow,
} from '@xyflow/react';
import { Download, LayoutGrid, Search, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EdgeType, HealthStatus, NodeType } from '@phloz/config';
import { Button, toast } from '@phloz/ui';

import '../node-types';
import { getNodeTypeDescriptor } from '../node-types/registry';
import type { TrackingEdgeDto, TrackingMapSnapshot, TrackingNodeDto } from '../types';

import { AddNodeMenu } from './add-node-menu';
import { PhlozMapNode, type PhlozNode, type PhlozNodeData } from './custom-node';
import { EdgeEditDialog, type EdgeEditState } from './edge-edit-dialog';
import { ImportMapDialog, type ImportPayload } from './import-dialog';
import { autoLayout } from './layout';
import { NodeDrawer } from './node-drawer';
import { NodeSearchDialog } from './search';

export { NodeSearchDialog } from './search';
export { EdgeEditDialog, EDGE_TYPE_LABELS } from './edge-edit-dialog';
export { ImportMapDialog } from './import-dialog';
export type { PhlozNode, PhlozNodeData } from './custom-node';

type CanvasAction =
  | {
      kind: 'create-node';
      payload: {
        tempId: string;
        nodeType: NodeType;
        label: string;
        metadata: Record<string, unknown>;
        position: { x: number; y: number };
      };
    }
  | {
      kind: 'update-node';
      payload: {
        id: string;
        label?: string;
        metadata?: Record<string, unknown>;
        healthStatus?: HealthStatus;
        position?: { x: number; y: number };
        markVerified?: boolean;
      };
    }
  | { kind: 'delete-node'; payload: { id: string } }
  | {
      kind: 'create-edge';
      payload: {
        tempId: string;
        sourceNodeId: string;
        targetNodeId: string;
        edgeType: EdgeType;
        label?: string | null;
      };
    }
  | {
      kind: 'update-edge';
      payload: {
        id: string;
        edgeType?: EdgeType;
        label?: string | null;
      };
    }
  | { kind: 'delete-edge'; payload: { id: string } }
  | {
      kind: 'import';
      payload: {
        nodes: Array<{
          id: string;
          nodeType: string;
          label: string;
          healthStatus?: string;
          position?: { x: number; y: number } | null;
          metadata?: Record<string, unknown>;
        }>;
        edges: Array<{
          sourceNodeId: string;
          targetNodeId: string;
          edgeType?: string;
          label?: string | null;
        }>;
      };
    };

export type CanvasActionHandler = (
  action: CanvasAction,
) => Promise<
  | { ok: true; replacementId?: string; nodesInserted?: number; edgesInserted?: number }
  | { ok: false; error: string }
>;

export type TrackingMapCanvasProps = {
  clientId: string;
  workspaceId: string;
  initial: TrackingMapSnapshot;
  onAction: CanvasActionHandler;
  /** Read-only mode — still interactive (pan/zoom) but no writes. */
  readOnly?: boolean;
  /** Fired when the user clicks "Arrange" (dagre auto-layout). Consumers
   *  use this to emit the `map_layout_arranged` analytics event. Kept
   *  as a callback so this package doesn't depend on @phloz/analytics. */
  onLayoutArranged?: () => void;
  /**
   * When set, the canvas centers + opens the drawer for this node on
   * mount (and when the id changes). Used by deep-links from the audit
   * engine's "View node →" buttons: `/map?node=<id>`.
   *
   * If the id doesn't match any loaded node we silently no-op — the
   * URL is user-supplied and we don't want to flash a 404 for a node
   * that was deleted between the audit being generated and the click.
   */
  focusNodeId?: string | null;
};

const NODE_TYPES = { phloz: PhlozMapNode };

export function TrackingMapCanvas(props: TrackingMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

const SOFT_NODE_CAP = 200;

function CanvasInner({
  clientId,
  workspaceId,
  initial,
  onAction,
  readOnly,
  onLayoutArranged,
  focusNodeId,
}: TrackingMapCanvasProps) {
  const { fitView, screenToFlowPosition, setCenter, getNode } = useReactFlow();
  const [nodes, setNodes] = useState<PhlozNode[]>(() =>
    initial.nodes.map((n) => toRfNode(n)),
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    initial.edges.map((e) => toRfEdge(e)),
  );
  const [drawer, setDrawer] = useState<{ open: true; node: PhlozNodeData } | { open: false }>({
    open: false,
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [edgeDialog, setEdgeDialog] = useState<EdgeEditState>({ open: false });

  // Keep a ref to throttle position autosaves per-node.
  const positionSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Deep-link focus: ?node=<id> centers the viewport on the node and
  // opens its drawer. We intentionally depend only on `focusNodeId` —
  // re-running on `nodes` changes would re-center every time the user
  // nudges a node, which would be infuriating. The ref guards against
  // effect re-fires when the same id is already handled.
  const focusedOnceRef = useRef<string | null>(null);
  // Reference nodes via a ref so the effect can read the latest list
  // without the linter needing it in the dep array.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  useEffect(() => {
    if (!focusNodeId) {
      focusedOnceRef.current = null;
      return;
    }
    if (focusedOnceRef.current === focusNodeId) return;
    const node = nodesRef.current.find((n) => n.id === focusNodeId);
    if (!node) return;
    focusedOnceRef.current = focusNodeId;
    // zoom: 1.2 brings the node close enough to read its label without
    // swallowing its neighbours. Duration 500 ms is snappy but obvious.
    setCenter(node.position.x + 120, node.position.y + 60, {
      zoom: 1.2,
      duration: 500,
    });
    setDrawer({ open: true, node: node.data });
  }, [focusNodeId, setCenter]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((current) => {
        const next = applyNodeChanges(changes, current) as PhlozNode[];

        if (!readOnly) {
          for (const change of changes) {
            if (change.type === 'position' && change.dragging === false) {
              const moved = next.find((n) => n.id === change.id);
              if (moved) schedulePositionSave(moved);
            }
          }
        }

        return next;
      });
    },
    [readOnly],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((current) => {
        const next = applyEdgeChanges(changes, current);
        if (!readOnly) {
          for (const change of changes) {
            if (change.type === 'remove') {
              void persistEdgeDelete(change.id);
            }
          }
        }
        return next;
      });
    },
    [readOnly],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return;
      // Instead of persisting immediately, open the edge dialog so the
      // user picks the edge type + optional label. We store the pending
      // connection in the dialog state; Save commits + persists.
      const src = nodes.find((n) => n.id === connection.source);
      const tgt = nodes.find((n) => n.id === connection.target);
      setEdgeDialog({
        open: true,
        mode: 'create',
        dbId: null,
        edgeType: 'custom',
        label: '',
        sourceLabel: src?.data.label,
        targetLabel: tgt?.data.label,
        // Carry the source/target so handleSave knows where to wire.
        // Cast via the state to keep the public type narrow.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(connection as any),
      } as EdgeEditState & { source: string; target: string });
    },
    [nodes, readOnly],
  );

  async function handleEdgeDialogSave(next: {
    edgeType: EdgeType;
    label: string;
  }) {
    if (!edgeDialog.open) return;
    const labelOrNull = next.label.trim() ? next.label.trim() : null;

    if (edgeDialog.mode === 'create') {
      // Read the stashed source/target off the dialog state.
      const pending = edgeDialog as unknown as { source: string; target: string };
      const tempId = `tmp-edge-${Math.random().toString(36).slice(2, 10)}`;
      const optimistic: Edge = {
        id: tempId,
        source: pending.source,
        target: pending.target,
        type: 'default',
        label: labelOrNull ?? undefined,
        data: { edgeType: next.edgeType },
      };
      setEdges((c) => addEdge(optimistic, c));
      setEdgeDialog({ open: false });

      const result = await onAction({
        kind: 'create-edge',
        payload: {
          tempId,
          sourceNodeId: pending.source,
          targetNodeId: pending.target,
          edgeType: next.edgeType,
          label: labelOrNull,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        setEdges((c) => c.filter((e) => e.id !== tempId));
        return;
      }
      if (result.replacementId) {
        setEdges((c) =>
          c.map((e) =>
            e.id === tempId ? { ...e, id: result.replacementId! } : e,
          ),
        );
      }
      return;
    }

    // edit mode
    if (!edgeDialog.dbId) return;
    const dbId = edgeDialog.dbId;
    setEdges((c) =>
      c.map((e) =>
        e.id === dbId
          ? {
              ...e,
              label: labelOrNull ?? undefined,
              data: { ...(e.data ?? {}), edgeType: next.edgeType },
            }
          : e,
      ),
    );
    setEdgeDialog({ open: false });

    const result = await onAction({
      kind: 'update-edge',
      payload: { id: dbId, edgeType: next.edgeType, label: labelOrNull },
    });
    if (!result.ok) toast.error(result.error);
  }

  async function handleEdgeDialogDelete() {
    if (!edgeDialog.open || edgeDialog.mode !== 'edit' || !edgeDialog.dbId) return;
    const dbId = edgeDialog.dbId;
    setEdges((c) => c.filter((e) => e.id !== dbId));
    setEdgeDialog({ open: false });
    const result = await onAction({ kind: 'delete-edge', payload: { id: dbId } });
    if (!result.ok) toast.error(result.error);
  }

  async function handleImport(payload: ImportPayload) {
    const result = await onAction({
      kind: 'import',
      payload,
    });
    if (!result.ok) return result;
    // Re-fetch on next render via router — caller triggers revalidatePath.
    // For immediate UX we'd reload here, but revalidation pipes through.
    return {
      ok: true as const,
      nodesInserted: result.nodesInserted ?? 0,
      edgesInserted: result.edgesInserted ?? 0,
    };
  }

  function schedulePositionSave(node: PhlozNode) {
    const existing = positionSaveTimers.current.get(node.id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      void onAction({
        kind: 'update-node',
        payload: {
          id: node.data.dbId,
          position: { x: node.position.x, y: node.position.y },
        },
      });
      positionSaveTimers.current.delete(node.id);
    }, 500);
    positionSaveTimers.current.set(node.id, timer);
  }

  async function persistEdgeDelete(id: string) {
    if (id.startsWith('tmp-edge-')) return;
    const result = await onAction({ kind: 'delete-edge', payload: { id } });
    if (!result.ok) toast.error(result.error);
  }

  async function handleAddNode(type: NodeType) {
    const descriptor = getNodeTypeDescriptor(type);
    const tempId = `tmp-node-${Math.random().toString(36).slice(2, 10)}`;
    // Drop somewhere visible — center of the current viewport.
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 - 100,
      y: window.innerHeight / 2 - 80,
    });
    const data: PhlozNodeData = {
      label: descriptor.label,
      nodeType: type,
      healthStatus: 'unverified',
      lastVerifiedAt: null,
      metadata: descriptor.defaults(),
      dbId: tempId,
    };

    const optimistic: PhlozNode = {
      id: tempId,
      type: 'phloz',
      data,
      position,
    };
    setNodes((c) => [...c, optimistic]);

    const result = await onAction({
      kind: 'create-node',
      payload: {
        tempId,
        nodeType: type,
        label: descriptor.label,
        metadata: descriptor.defaults(),
        position,
      },
    });
    if (!result.ok) {
      toast.error(result.error);
      setNodes((c) => c.filter((n) => n.id !== tempId));
      return;
    }
    if (result.replacementId) {
      const realId = result.replacementId;
      setNodes((c) =>
        c.map((n) =>
          n.id === tempId
            ? { ...n, id: realId, data: { ...n.data, dbId: realId } }
            : n,
        ),
      );
      // Open the drawer on the newly-created node so the user can fill
      // in fields right away.
      setDrawer({ open: true, node: { ...data, dbId: realId } });
    } else {
      setDrawer({ open: true, node: data });
    }
  }

  async function handleDrawerSave(update: {
    id: string;
    label: string;
    metadata: Record<string, unknown>;
    healthStatus: HealthStatus;
    markVerified: boolean;
  }) {
    const result = await onAction({
      kind: 'update-node',
      payload: update,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const verifiedAt = update.markVerified ? new Date() : undefined;
    setNodes((c) =>
      c.map((n) =>
        n.data.dbId === update.id
          ? {
              ...n,
              data: {
                ...n.data,
                label: update.label,
                metadata: update.metadata,
                healthStatus: update.healthStatus,
                ...(verifiedAt ? { lastVerifiedAt: verifiedAt } : {}),
              },
            }
          : n,
      ),
    );
    toast.success('Saved');
  }

  async function handleDrawerDelete(id: string) {
    const result = await onAction({ kind: 'delete-node', payload: { id } });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setNodes((c) => c.filter((n) => n.data.dbId !== id));
    setEdges((c) => c.filter((e) => {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
      return src?.data.dbId !== id && tgt?.data.dbId !== id;
    }));
    toast.success('Deleted');
  }

  function handleArrange() {
    const laidOut = autoLayout(nodes, edges);
    const typed = laidOut.nodes as PhlozNode[];
    setNodes(typed);
    setEdges(laidOut.edges);
    // Autosave each new position.
    for (const n of typed) {
      schedulePositionSave(n);
    }
    setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 50);
    onLayoutArranged?.();
  }

  // Clean up pending debounces on unmount.
  useEffect(
    () => () => {
      for (const t of positionSaveTimers.current.values()) clearTimeout(t);
    },
    [],
  );

  // Global keyboard shortcuts. Ignore if focus is inside a form input so
  // typing "n" in a metadata field doesn't open the add-node menu.
  useEffect(() => {
    if (readOnly) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setAddMenuOpen(true);
      } else if (e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === 'Escape') {
        setDrawer({ open: false });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  function handleExportJson() {
    const payload = {
      workspaceId,
      clientId,
      exportedAt: new Date().toISOString(),
      nodes: nodes.map((n) => ({
        id: n.data.dbId,
        nodeType: n.data.nodeType,
        label: n.data.label,
        healthStatus: n.data.healthStatus,
        lastVerifiedAt: n.data.lastVerifiedAt,
        position: n.position,
        metadata: n.data.metadata,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.source,
        targetNodeId: e.target,
        label: typeof e.label === 'string' ? e.label : null,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracking-map-${clientId}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleSearchPick(nodeId: string) {
    const n = getNode(nodeId);
    if (!n) return;
    setCenter(n.position.x + 120, n.position.y + 40, {
      zoom: 1.2,
      duration: 350,
    });
    setDrawer({ open: true, node: n.data as PhlozNodeData });
  }

  const nodeTypes = useMemo(() => NODE_TYPES, []);

  return (
    <div className="relative size-full min-h-[520px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => {
          setDrawer({ open: true, node: node.data as PhlozNodeData });
        }}
        onEdgeClick={(_, edge) => {
          if (readOnly) return;
          const src = nodes.find((n) => n.id === edge.source);
          const tgt = nodes.find((n) => n.id === edge.target);
          const data = (edge.data ?? {}) as { edgeType?: EdgeType };
          setEdgeDialog({
            open: true,
            mode: 'edit',
            dbId: edge.id,
            edgeType: data.edgeType ?? 'custom',
            label: typeof edge.label === 'string' ? edge.label : '',
            sourceLabel: src?.data.label,
            targetLabel: tgt?.data.label,
          });
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        edgesFocusable={!readOnly}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="var(--color-border)"
        />
        <Controls className="!shadow-md" />
        <MiniMap
          pannable
          zoomable
          nodeColor={() => 'var(--color-primary)'}
          maskColor="rgba(0,0,0,0.6)"
        />
        {!readOnly && (
          <Panel position="top-left">
            <div className="flex items-center gap-1 rounded-md border border-border bg-card/80 p-1 backdrop-blur-sm">
              <AddNodeMenu
                onPick={handleAddNode}
                open={addMenuOpen}
                onOpenChange={setAddMenuOpen}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={handleArrange}
                className="gap-1.5"
                title="Auto-layout (dagre)"
              >
                <LayoutGrid className="size-3.5" /> Arrange
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSearchOpen(true)}
                className="gap-1.5"
                title="Search nodes ( / )"
              >
                <Search className="size-3.5" /> Search
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExportJson}
                className="gap-1.5"
                title="Export map JSON"
              >
                <Download className="size-3.5" /> Export
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setImportOpen(true)}
                className="gap-1.5"
                title="Import map JSON"
              >
                <Upload className="size-3.5" /> Import
              </Button>
              <div
                className={`pl-2 pr-1 text-xs ${
                  nodes.length >= SOFT_NODE_CAP
                    ? 'text-[var(--color-warning)]'
                    : 'text-muted-foreground'
                }`}
                title={
                  nodes.length >= SOFT_NODE_CAP
                    ? `Soft cap of ${SOFT_NODE_CAP} reached — contact support if you need to raise it`
                    : undefined
                }
              >
                {nodes.length} node{nodes.length === 1 ? '' : 's'} ·{' '}
                {edges.length} edge{edges.length === 1 ? '' : 's'}
              </div>
            </div>
          </Panel>
        )}
      </ReactFlow>

      <NodeDrawer
        state={drawer}
        onClose={() => setDrawer({ open: false })}
        onSave={handleDrawerSave}
        onDelete={handleDrawerDelete}
      />

      <NodeSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        nodes={nodes}
        onSelect={handleSearchPick}
      />

      <EdgeEditDialog
        state={edgeDialog}
        onCancel={() => setEdgeDialog({ open: false })}
        onSave={handleEdgeDialogSave}
        onDelete={
          edgeDialog.open && edgeDialog.mode === 'edit'
            ? handleEdgeDialogDelete
            : undefined
        }
      />

      <ImportMapDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImport}
      />

      {/* Hidden context so the component doesn't warn about unused
          workspaceId/clientId — they're passed as data attributes so
          server-action callers can read them if needed. */}
      <div
        className="hidden"
        data-workspace-id={workspaceId}
        data-client-id={clientId}
      />
    </div>
  );
}

function toRfNode(dto: TrackingNodeDto): PhlozNode {
  return {
    id: dto.id,
    type: 'phloz',
    position: dto.position ?? { x: 0, y: 0 },
    data: {
      label: dto.label,
      nodeType: dto.nodeType,
      healthStatus: dto.healthStatus,
      lastVerifiedAt: dto.lastVerifiedAt,
      metadata: dto.metadata,
      dbId: dto.id,
    },
  };
}

function toRfEdge(dto: TrackingEdgeDto): Edge {
  return {
    id: dto.id,
    source: dto.sourceNodeId,
    target: dto.targetNodeId,
    label: dto.label ?? undefined,
    data: { edgeType: dto.edgeType },
  };
}
