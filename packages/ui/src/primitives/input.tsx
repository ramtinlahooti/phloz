import * as React from 'react';
import { cn } from '../cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
          'placeholder:text-[var(--color-muted-foreground)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--color-foreground)]',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
