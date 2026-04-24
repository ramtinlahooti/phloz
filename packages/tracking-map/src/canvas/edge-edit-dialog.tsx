'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { EdgeType } from '@phloz/config';
import { EDGE_TYPES } from '@phloz/config';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@phloz/ui';

export type EdgeEditState =
  | {
      open: true;
      mode: 'create' | 'edit';
      dbId: string | null; // null when mode=create and edge hasn't been persisted yet
      edgeType: EdgeType;
      label: string;
      /** Context shown in the dialog (optional). */
      sourceLabel?: string;
      targetLabel?: string;
    }
  | { open: false };

/** Human labels for the edge-type enum — used by the picker. */
export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  sends_events_to: 'Sends events to',
  fires_pixel: 'Fires pixel',
  reports_conversions_to: 'Reports conversions to',
  sends_server_events_to: 'Sends server events to',
  uses_data_layer: 'Uses data layer',
  pushes_audiences_to: 'Pushes audiences to',
  syncs_leads_to: 'Syncs leads to',
  custom: 'Custom',
};

type Props = {
  state: EdgeEditState;
  onCancel: () => void;
  onSave: (next: { edgeType: EdgeType; label: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
};

/**
 * Dialog used in two modes:
 * - `create` — pops open after the user drags an edge between two
 *   nodes, lets them pick edge type + label before persisting.
 * - `edit` — pops open when the user clicks an existing edge, lets
 *   them change type / label / delete.
 */
export function EdgeEditDialog({ state, onCancel, onSave, onDelete }: Props) {
  const initialType = state.open ? state.edgeType : 'custom';
  const initialLabel = state.open ? state.label : '';
  const [edgeType, setEdgeType] = useState<EdgeType>(initialType);
  const [label, setLabel] = useState(initialLabel);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.open) {
      setEdgeType(state.edgeType);
      setLabel(state.label);
    }
  }, [state]);

  if (!state.open) return null;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ edgeType, label: label.trim() });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm('Remove this connection?')) return;
    setSaving(true);
    try {
      await onDelete();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state.mode === 'create' ? 'New connection' : 'Edit connection'}
          </DialogTitle>
          <DialogDescription>
            {state.sourceLabel && state.targetLabel
              ? `${state.sourceLabel} → ${state.targetLabel}`
              : 'How does one node feed the other?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Relationship</Label>
            <Select
              value={edgeType}
              onValueChange={(v) => setEdgeType(v as EdgeType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDGE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {EDGE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Label (optional)</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. server-side, via CAPI"
              maxLength={120}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {state.mode === 'edit' && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={saving}
              className="sm:mr-auto"
            >
              <Trash2 className="size-4" /> Remove
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving
              ? 'Saving…'
              : state.mode === 'create'
                ? 'Create connection'
                : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
