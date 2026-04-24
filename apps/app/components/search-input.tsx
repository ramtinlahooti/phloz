'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Input } from '@phloz/ui';

/**
 * URL-param-backed search input. Shared across list pages (`/clients`,
 * `/tasks`, etc.) so the UX is identical everywhere.
 *
 * Design notes:
 * - The URL is the source of truth (`?q=foo`). That makes searches
 *   shareable, browser-back friendly, and survives refreshes.
 * - Typing updates URL state via `router.replace` (no history entries
 *   piling up) with a 250 ms debounce so we don't thrash on every
 *   keystroke.
 * - The page is a server component that filters based on `q` in its
 *   search params — no extra fetches are needed here beyond what the
 *   page already does.
 * - Other query params are preserved when we change `q` (so clicking a
 *   department pill *then* searching doesn't wipe the department).
 */
export function SearchInput({
  param = 'q',
  placeholder = 'Search…',
  className,
}: {
  /** URL param name. Defaults to `q`. */
  param?: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const urlValue = urlParams?.get(param) ?? '';
  const [value, setValue] = useState(urlValue);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync when the URL changes from elsewhere (e.g. a
  // filter-pill click that also clears `q`). Deliberately depends only
  // on `urlValue` — we don't want the effect to re-run when the user
  // is typing, only when the URL source-of-truth shifts.
  useEffect(() => {
    setValue((prev) => (prev === urlValue ? prev : urlValue));
  }, [urlValue]);

  function commit(next: string) {
    const params = new URLSearchParams(urlParams?.toString() ?? '');
    if (next.trim()) {
      params.set(param, next.trim());
    } else {
      params.delete(param);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(next), 250);
  }

  function clear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue('');
    commit('');
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 pl-8 pr-8 text-xs"
        // Prevent the browser's native search clear button from also
        // existing next to our custom one.
        style={{ WebkitAppearance: 'none' }}
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
