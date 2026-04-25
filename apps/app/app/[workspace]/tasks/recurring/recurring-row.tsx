'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { Button, toast } from '@phloz/ui';

import {
  deleteRecurringTemplateAction,
  setRecurringEnabledAction,
} from './actions';

type Props = {
  workspaceId: string;
  template: {
    id: string;
    title: string;
    cadenceSummary: string;
    clientName: string | null;
    department: string;
    enabled: boolean;
    lastRunAt: Date | null;
    canDelete: boolean;
  };
};

export function RecurringRow({ workspaceId, template }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle(checked: boolean) {
    startTransition(async () => {
      const res = await setRecurringEnabledAction({
        workspaceId,
        id: template.id,
        enabled: checked,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${template.title}"? This won't remove tasks already created from it.`)) return;
    startTransition(async () => {
      const res = await deleteRecurringTemplateAction({
        workspaceId,
        id: template.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Template deleted');
      router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">
            {template.title}
          </span>
          {!template.enabled && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              Paused
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {template.cadenceSummary}
          {template.clientName && <> · {template.clientName}</>}
          <> · </>
          <span className="capitalize">{template.department.replace('_', ' ')}</span>
          {template.lastRunAt && (
            <> · last fired {template.lastRunAt.toLocaleDateString()}</>
          )}
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={template.enabled}
          disabled={pending}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-4 rounded border-border accent-primary"
        />
        Enabled
      </label>
      {template.canDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={pending}
          aria-label="Delete recurring template"
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}
