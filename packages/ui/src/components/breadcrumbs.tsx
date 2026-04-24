import { ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '../cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Lightweight breadcrumb trail. Terminal item (last) never renders as
 * a link; intermediate items do. Server-component safe — uses a
 * generic `<a>` so the consumer can swap in `next/link` via `asChild`-
 * style wrapping if they want prefetching (most nav breadcrumbs don't
 * need it).
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground',
        className,
      )}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {isLast || !item.href ? (
              <span
                className={cn(isLast && 'text-foreground')}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            ) : (
              <a
                href={item.href}
                className="transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            )}
            {!isLast && (
              <ChevronRight
                className="size-3 text-muted-foreground/60"
                aria-hidden
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
