'use client';

import {
  CreditCard,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  Search,
  Settings,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Input,
} from '@phloz/ui';

import {
  listCommandPaletteItemsAction,
  type PaletteClient,
  type PaletteTask,
} from '@/app/[workspace]/command-palette-actions';

/**
 * Global command palette. Opens on ⌘K / Ctrl+K from anywhere under
 * the authenticated workspace layout.
 *
 * Data sources (all filtered by the query string):
 * - **Shortcuts** — quick-links to new-client / invite-teammate
 *   forms. Static, always visible.
 * - **Pages** — workspace nav destinations. Static.
 * - **Clients** — lazy-fetched on first open. Limited to ~100 active
 *   clients; larger workspaces should still feel snappy because we
 *   filter in-memory.
 * - **Tasks** — lazy-fetched on first open. Limited to ~200 recent
 *   parent tasks. Clicking jumps to `/tasks?q=<title>` so the row
 *   gets highlighted via the existing URL-param search.
 *
 * UX:
 * - Arrow keys navigate. Enter activates. Escape closes.
 * - Results group by category, but the active-row cursor moves
 *   across groups so arrow keys feel continuous.
 * - No deep search — substring match only, lowercase, on whatever
 *   the item's primary label is. Good enough at launch scale.
 */

type PaletteItem = {
  id: string;
  /** Category label shown as the group header. */
  group: 'Shortcuts' | 'Pages' | 'Clients' | 'Tasks';
  label: string;
  /** Secondary line, shown in muted style under the label. */
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Activate the item — typically a navigation, occasionally a
   *  callback. Palette closes automatically after activation unless
   *  the handler returns `false`. */
  onActivate: () => void | boolean;
};

export function CommandPalette({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [clients, setClients] = useState<PaletteClient[]>([]);
  const [tasks, setTasks] = useState<PaletteTask[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Toggle on ⌘K / Ctrl+K from anywhere. Listener lives at `document`
  // so it works regardless of focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Lazy-fetch the client + task lists the first time the palette
  // opens. Subsequent opens reuse the cached results.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      const res = await listCommandPaletteItemsAction({ workspaceId });
      if (cancelled) return;
      if (res.ok) {
        setClients(res.clients);
        setTasks(res.tasks);
        setLoaded(true);
      }
      // Silently fall through on errors — the static shortcuts + pages
      // still work, and the user can close + retry.
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loaded, workspaceId]);

  // Reset the query + cursor every time the palette opens. Keeps the
  // "press ⌘K to start searching" mental model.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  // Build the full item list (groups + their rows). Everything is
  // static except clients + tasks.
  const items: PaletteItem[] = useMemo(() => {
    const base = `/${workspaceId}`;
    const all: PaletteItem[] = [
      {
        id: 'shortcut:new-client',
        group: 'Shortcuts',
        label: 'New client',
        subtitle: 'Open the add-client form',
        icon: UserPlus,
        onActivate: () => go(`${base}/clients/new`),
      },
      {
        id: 'shortcut:invite-teammate',
        group: 'Shortcuts',
        label: 'Invite teammate',
        subtitle: 'Open the team page',
        icon: UsersRound,
        onActivate: () => go(`${base}/team`),
      },
      {
        id: 'page:overview',
        group: 'Pages',
        label: 'Overview',
        icon: LayoutDashboard,
        onActivate: () => go(base),
      },
      {
        id: 'page:clients',
        group: 'Pages',
        label: 'Clients',
        icon: Users,
        onActivate: () => go(`${base}/clients`),
      },
      {
        id: 'page:tasks',
        group: 'Pages',
        label: 'Tasks',
        icon: ListChecks,
        onActivate: () => go(`${base}/tasks`),
      },
      {
        id: 'page:messages',
        group: 'Pages',
        label: 'Messages',
        icon: MessagesSquare,
        onActivate: () => go(`${base}/messages`),
      },
      {
        id: 'page:team',
        group: 'Pages',
        label: 'Team',
        icon: UsersRound,
        onActivate: () => go(`${base}/team`),
      },
      {
        id: 'page:billing',
        group: 'Pages',
        label: 'Billing',
        icon: CreditCard,
        onActivate: () => go(`${base}/billing`),
      },
      {
        id: 'page:settings',
        group: 'Pages',
        label: 'Settings',
        icon: Settings,
        onActivate: () => go(`${base}/settings`),
      },
    ];
    for (const c of clients) {
      all.push({
        id: `client:${c.id}`,
        group: 'Clients',
        label: c.name,
        icon: Users,
        onActivate: () => go(`${base}/clients/${c.id}`),
      });
    }
    for (const t of tasks) {
      all.push({
        id: `task:${t.id}`,
        group: 'Tasks',
        label: t.title,
        subtitle: t.clientName ?? undefined,
        icon: ListChecks,
        // Deep-link via `?task=<id>` — TaskRow instances on the
        // destination page auto-open the detail dialog when their
        // id matches. Client-scoped tasks land on the client page
        // (richer context: approval, map, files) rather than the
        // workspace list.
        onActivate: () =>
          go(
            t.clientId
              ? `${base}/clients/${t.clientId}?task=${t.id}`
              : `${base}/tasks?task=${t.id}`,
          ),
      });
    }
    return all;
  }, [clients, tasks, workspaceId, go]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return items;
    return items.filter((i) => {
      const hay = `${i.label} ${i.subtitle ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, q]);

  // Clamp activeIndex to a valid row when the filtered list changes.
  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, activeIndex]);

  // Scroll the active row into view when it changes.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-palette-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = filtered[activeIndex];
      if (active) active.onActivate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Group the filtered items for display while keeping `filtered` as
  // the flat source of truth for the active-index pointer.
  const groups = useMemo(() => {
    const byGroup = new Map<PaletteItem['group'], PaletteItem[]>();
    for (const item of filtered) {
      const list = byGroup.get(item.group) ?? [];
      list.push(item);
      byGroup.set(item.group, list);
    }
    const order: PaletteItem['group'][] = [
      'Shortcuts',
      'Pages',
      'Clients',
      'Tasks',
    ];
    return order
      .map((g) => ({ group: g, items: byGroup.get(g) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl gap-0 p-0"
        // Hide the default close button's visual — we have Escape.
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Jump to a client, task, or page…"
              aria-label="Command palette search"
              className="h-8 border-0 pl-8 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>

        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matches for &quot;{query}&quot;.
            </p>
          ) : (
            <div>
              {groups.map(({ group, items: groupItems }) => (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                  <ul>
                    {groupItems.map((item) => {
                      // The index inside the flat `filtered` array —
                      // need that for the active-highlight pointer.
                      const flatIndex = filtered.indexOf(item);
                      const active = flatIndex === activeIndex;
                      const Icon = item.icon;
                      return (
                        <li
                          key={item.id}
                          data-palette-index={flatIndex}
                        >
                          <button
                            type="button"
                            onClick={() => item.onActivate()}
                            onMouseEnter={() => setActiveIndex(flatIndex)}
                            className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                              active
                                ? 'bg-primary/10 text-foreground'
                                : 'text-foreground/90 hover:bg-muted/50'
                            }`}
                          >
                            {Icon && (
                              <Icon className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              {item.label}
                            </span>
                            {item.subtitle && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono">
              ↑↓
            </kbd>{' '}
            navigate
          </span>
          <span className="mx-3">
            <kbd className="rounded border border-border bg-muted px-1 font-mono">
              ↵
            </kbd>{' '}
            select
          </span>
          <span>
            <kbd className="rounded border border-border bg-muted px-1 font-mono">
              esc
            </kbd>{' '}
            close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
