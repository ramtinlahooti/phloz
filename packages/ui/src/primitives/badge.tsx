import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2 focus:ring-offset-[var(--color-background)]',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
        secondary:
          'border-transparent bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]',
        destructive:
          'border-transparent bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]',
        success:
          'border-transparent bg-[var(--color-success)] text-[var(--color-primary-foreground)]',
        warning:
          'border-transparent bg-[var(--color-warning)] text-black',
        outline:
          'border-[var(--color-border)] bg-transparent text-[var(--color-foreground)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { badgeVariants };
