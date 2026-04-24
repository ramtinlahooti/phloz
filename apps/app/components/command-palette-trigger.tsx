'use client';

import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Faux search input in the sidebar that opens the ⌘K palette. The
 * palette itself toggles on the keyboard shortcut, but without a
 * visible trigger most users would never discover it. Clicking the
 * trigger dispatches a synthetic Cmd+K keydown event on `document`;
 * the palette's global listener picks it up.
 *
 * Keeping state coordination via synthetic events rather than a
 * shared context or store because there's exactly one palette + one
 * trigger per page, and the keyboard shortcut is the authoritative
 * path anyway — this is just a button alias for it.
 */
export function CommandPaletteTrigger() {
  const [shortcut, setShortcut] = useState('⌘K');

  useEffect(() => {
    // Native OS hint. `navigator.platform` is partially deprecated
    // but still widely supported and our only option without the
    // experimental `userAgentData`. Fine as a presentation-only hint.
    if (typeof navigator !== 'undefined') {
      setShortcut(
        navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K',
      );
    }
  }, []);

  function open() {
    // Synthesize the shortcut the palette already listens for. Keeps
    // the palette's open-state internal — no prop drilling, no store.
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      }),
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-card/50 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      aria-label="Open command palette"
    >
      <Search className="size-3.5" aria-hidden />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
        {shortcut}
      </kbd>
    </button>
  );
}
