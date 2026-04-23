'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';

import type { HealthStatus, NodeType } from '@phloz/config';

import { formatLastVerified, HEALTH_STATUS_CONFIG } from '../health';
import { getNodeTypeDescriptor } from '../node-types/registry';

export type PhlozNodeData = {
  label: string;
  nodeType: NodeType;
  healthStatus: HealthStatus;
  lastVerifiedAt: Date | null;
  metadata: Record<string, unknown>;
  dbId: string;
  // React Flow requires data to be an index-signatured record.
  [key: string]: unknown;
};

export type PhlozNode = Node<PhlozNodeData, 'phloz'>;

/**
 * Single Phloz node renderer. Every tracking node (regardless of type)
 * passes through here — the type descriptor in the registry provides
 * icon, accent colour, and metadata shape.
 *
 * Handles are rendered on both sides so an edge can originate from any
 * direction.
 */
export function PhlozMapNode({ data, selected }: NodeProps<PhlozNode>) {
  const descriptor = getNodeTypeDescriptor(data.nodeType);
  const Icon = descriptor.icon;
  const health = HEALTH_STATUS_CONFIG[data.healthStatus];

  return (
    <div className={clsx('phloz-node', selected && 'selected')}>
      <Handle type="target" position={Position.Left} />
      <div className="phloz-node__header">
        <Icon className={clsx('size-4 shrink-0', descriptor.accent)} aria-hidden />
        <span className="phloz-node__title" title={data.label}>
          {data.label || descriptor.label}
        </span>
      </div>
      <div className="phloz-node__meta">
        <span
          className="phloz-node__health-dot"
          style={{ background: health.color }}
          aria-label={health.label}
        />
        <span>{health.label}</span>
        <span aria-hidden>·</span>
        <span>{formatLastVerified(data.lastVerifiedAt)}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
