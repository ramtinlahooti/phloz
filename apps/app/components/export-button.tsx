'use client';

import { Download } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { buttonVariants, toast } from '@phloz/ui';

/**
 * Export-to-CSV button. Assembles the download URL from the route
 * prop + the current page's search params (so "Export" exports
 * exactly what the user is looking at, filters and all).
 *
 * Uses a plain `<a>` with `download` for the browser-native download
 * flow. If the route returns a 403 (role denied) or 5xx, we fall
 * back to an `<a>` click that would still redirect; we can't detect
 * those here without a fetch — so the server returns a friendly 403
 * JSON and the user sees a text dump. Acceptable for V1; revisit
 * if someone complains.
 */
export function ExportButton({
  route,
  label = 'Export CSV',
  /** Extra static params to always include (e.g. `includeArchived=true`). */
  extraParams,
}: {
  /** Absolute path to the export route, e.g.
   *  `/api/workspaces/{id}/clients/export`. */
  route: string;
  label?: string;
  extraParams?: Record<string, string>;
}) {
  const urlParams = useSearchParams();
  const [pending, setPending] = useState(false);

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const params = new URLSearchParams(urlParams?.toString() ?? '');
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          params.set(k, v);
        }
      }
      const qs = params.toString();
      const url = qs ? `${route}?${qs}` : route;
      // Use a synthetic anchor so the browser handles the download
      // itself — no need to manage a Blob or revokeObjectURL. The
      // server's Content-Disposition controls the filename.
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error(`Export failed: ${(err as Error).message}`);
    } finally {
      // Reset immediately — the anchor click has already fired.
      setPending(false);
    }
  }

  return (
    <a
      href={route}
      onClick={onClick}
      className={`${buttonVariants({ size: 'sm', variant: 'outline' })} gap-1.5`}
      aria-label={label}
    >
      <Download className="size-3.5" />
      {pending ? 'Exporting…' : label}
    </a>
  );
}
