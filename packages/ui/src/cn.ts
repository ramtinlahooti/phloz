import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind-aware class merger. Later classes win over conflicting earlier
 * ones (e.g. `cn('p-2', 'p-4')` resolves to `p-4`).
 *
 * Standard shadcn pattern — every component in this package uses it.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
