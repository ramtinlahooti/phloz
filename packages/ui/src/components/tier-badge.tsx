import * as React from 'react';
import { Badge, type BadgeProps } from '../primitives/badge';
import { cn } from '../cn';

export type TierSlug =
  | 'starter'
  | 'pro'
  | 'growth'
  | 'business'
  | 'scale'
  | 'enterprise';

export interface TierBadgeProps
  extends Omit<BadgeProps, 'variant' | 'children'> {
  tier: TierSlug;
  /** Override the displayed label (defaults to title-cased `tier`). */
  label?: string;
}

const TIER_LABEL: Record<TierSlug, string> = {
  starter: 'Starter',
  pro: 'Pro',
  growth: 'Growth',
  business: 'Business',
  scale: 'Scale',
  enterprise: 'Enterprise',
};

const TIER_CLASS: Record<TierSlug, string> = {
  starter:
    'border-[var(--color-border)] bg-transparent text-[var(--color-muted-foreground)]',
  pro: 'border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
  growth:
    'border-transparent bg-[var(--color-accent)] text-[var(--color-accent-foreground)]',
  business:
    'border-transparent bg-[var(--color-info)] text-[var(--color-primary-foreground)]',
  scale:
    'border-transparent bg-[var(--color-warning)] text-black',
  enterprise:
    'border-transparent bg-[var(--color-foreground)] text-[var(--color-background)]',
};

/**
 * Visual tier marker. Used on workspace settings, billing page, and
 * wherever a tier needs a compact visual tag.
 *
 * Single source of tier names + classes so changing a tier palette is
 * one diff.
 */
export function TierBadge({
  tier,
  label,
  className,
  ...props
}: TierBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(TIER_CLASS[tier], 'capitalize', className)}
      {...props}
    >
      {label ?? TIER_LABEL[tier]}
    </Badge>
  );
}
