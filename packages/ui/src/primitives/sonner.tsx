'use client';

import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Site-wide toast renderer. Mount once in the root layout.
 *
 * Usage:
 * ```tsx
 * import { Toaster } from '@phloz/ui';
 * <Toaster />  // in root layout
 *
 * import { toast } from '@phloz/ui';
 * toast.success('Saved');
 * ```
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-[var(--color-popover)] group-[.toaster]:text-[var(--color-popover-foreground)] group-[.toaster]:border group-[.toaster]:border-[var(--color-border)] group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-[var(--color-muted-foreground)]',
          actionButton:
            'group-[.toast]:bg-[var(--color-primary)] group-[.toast]:text-[var(--color-primary-foreground)]',
          cancelButton:
            'group-[.toast]:bg-[var(--color-muted)] group-[.toast]:text-[var(--color-muted-foreground)]',
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
