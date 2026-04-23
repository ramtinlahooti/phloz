import * as React from 'react';
import { cn } from '../cn';

export interface PageHeaderProps {
  /** Page h1. */
  title: string;
  /** Subtitle / description under the title. */
  description?: string;
  /** Breadcrumb or back-link content rendered above the title. */
  eyebrow?: React.ReactNode;
  /** Right-aligned action slot (e.g. primary button). */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header used across app and marketing routes. Keeps
 * typography + spacing consistent without committing to a specific
 * layout primitive.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow ? (
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-2xl font-semibold tracking-tight text-[var(--color-foreground)] sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
