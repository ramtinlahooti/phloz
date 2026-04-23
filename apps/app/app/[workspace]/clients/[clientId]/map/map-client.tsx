'use client';

import type { TrackingMapSnapshot } from '@phloz/tracking-map';
import {
  TrackingMapCanvas,
  type CanvasActionHandler,
} from '@phloz/tracking-map/canvas';
import '@phloz/tracking-map/styles';

import {
  createEdgeAction,
  createNodeAction,
  deleteEdgeAction,
  deleteNodeAction,
  updateNodeAction,
} from './actions';

/**
 * Thin client wrapper that binds the canvas action handler to the
 * server actions for this workspace + client. Kept out of the map
 * page so the page can stay a server component.
 */
export function MapClient({
  workspaceId,
  clientId,
  initial,
}: {
  workspaceId: string;
  clientId: string;
  initial: TrackingMapSnapshot;
}) {
  const handler: CanvasActionHandler = async (action) => {
    switch (action.kind) {
      case 'create-node': {
        const res = await createNodeAction({
          workspaceId,
          clientId,
          nodeType: action.payload.nodeType,
          label: action.payload.label,
          metadata: action.payload.metadata,
          position: action.payload.position,
        });
        return res.ok
          ? { ok: true, replacementId: res.id }
          : { ok: false, error: res.error };
      }
      case 'update-node': {
        const res = await updateNodeAction({
          workspaceId,
          id: action.payload.id,
          label: action.payload.label,
          metadata: action.payload.metadata,
          healthStatus: action.payload.healthStatus,
          position: action.payload.position,
          markVerified: action.payload.markVerified,
        });
        return res.ok ? { ok: true } : { ok: false, error: res.error };
      }
      case 'delete-node': {
        const res = await deleteNodeAction({ workspaceId, id: action.payload.id });
        return res.ok ? { ok: true } : { ok: false, error: res.error };
      }
      case 'create-edge': {
        const res = await createEdgeAction({
          workspaceId,
          clientId,
          sourceNodeId: action.payload.sourceNodeId,
          targetNodeId: action.payload.targetNodeId,
          edgeType: action.payload.edgeType,
        });
        return res.ok
          ? { ok: true, replacementId: res.id }
          : { ok: false, error: res.error };
      }
      case 'delete-edge': {
        const res = await deleteEdgeAction({ workspaceId, id: action.payload.id });
        return res.ok ? { ok: true } : { ok: false, error: res.error };
      }
    }
  };

  return (
    <TrackingMapCanvas
      workspaceId={workspaceId}
      clientId={clientId}
      initial={initial}
      onAction={handler}
    />
  );
}
