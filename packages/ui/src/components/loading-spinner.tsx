import * as React from 'react';
import { cn } from '../cn';

export interface LoadingSpinnerProps
  extends React.SVGAttributes<SVGSVGElement> {
  /** Visual size — maps to width/height in Tailwind sizing units. */
  size?: 'sm' | 'md' | 'lg';
  /** Screen-reader label; defaults to "Loading". */
  label?: string;
}

const SIZE_CLASS: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-8',
};

/**
 * Simple CSS-animated spinner. No external dep. Use for async states
 * where a full Skeleton would be overkill.
 */
export function LoadingSpinner({
  className,
  size = 'md',
  label = 'Loading',
  ...props
}: LoadingSpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'animate-spin text-[var(--color-muted-foreground)]',
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
