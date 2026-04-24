'use client';

import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@phloz/ui';

import { applyTaskTemplateAction } from './actions';
import { TASK_TEMPLATES, type TaskTemplate } from './templates';

/**
 * Picker that applies a built-in task template to the client. Grouped
 * by `category` for scannability. Each item shows name + one-line
 * summary.
 */
export function ApplyTemplateButton({
  workspaceId,
  clientId,
}: {
  workspaceId: string;
  clientId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const byCategory = groupByCategory(TASK_TEMPLATES);

  function apply(templateId: string) {
    startTransition(async () => {
      const res = await applyTaskTemplateAction({
        workspaceId,
        clientId,
        templateId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Added ${res.created} task${res.created === 1 ? '' : 's'}`,
      );
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={pending}
        >
          <Sparkles className="size-3.5" />
          Apply template
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {Object.entries(byCategory).map(([category, templates], idx) => (
          <DropdownMenuGroup key={category}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="capitalize">
              {category}
            </DropdownMenuLabel>
            {templates.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => apply(t.id)}
                className="flex-col items-start gap-0.5"
              >
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  {t.summary} ({t.items.length} task
                  {t.items.length === 1 ? '' : 's'})
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function groupByCategory(
  templates: readonly TaskTemplate[],
): Record<string, TaskTemplate[]> {
  const out: Record<string, TaskTemplate[]> = {};
  for (const t of templates) {
    if (!out[t.category]) out[t.category] = [];
    out[t.category]!.push(t);
  }
  return out;
}
