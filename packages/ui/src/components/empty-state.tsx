import * as React from 'react';
import { cn } from '../cn';

export interface EmptyStateProps {
  /** Short headline for the empty state. */
  title: string;
  /** Supporting sentence explaining what to do next. */
  description?: string;
  /** Optional icon rendered above the title (e.g. lucide-react icon). */
  icon?: React.ReactNode;
  /** Primary CTA (e.g. a `<Button>` to create the first resource). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Friendly empty-state card. Used for list pages before any data exists
 * (clients, tasks, tracking map nodes, etc.).
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-[var(--color-foreground)]">
          {title}
        </h3>
        {description ? (
          <p className="max-w-sm text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
