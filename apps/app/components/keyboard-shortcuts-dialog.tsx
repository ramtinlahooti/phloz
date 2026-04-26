'use client';

import { Keyboard } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@phloz/ui';

/**
 * Globally-available "Keyboard shortcuts" cheat sheet, triggered by
 * `?` (and `Shift-?` for keyboard layouts that need shift). Mounted
 * once in the dashboard shell so every authenticated page gets it
 * without per-route wiring.
 *
 * Why a separate component: a single Radix Dialog + a single key
 * listener; piggybacking on the command palette would muddy that
 * component's "search and navigate" intent.
 */
export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const isMac =
    typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const mod = isMac ? '⌘' : 'Ctrl';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't intercept when typing in a field.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      ) {
        return;
      }
      // `?` is shift+`/` on US keyboards; some layouts produce `?`
      // directly. Match either path.
      if (e.key === '?') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === 'Escape' && open) {
        // Radix Dialog already handles Escape, but ensure the local
        // state stays in sync if the global handler fires first.
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="size-4" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Press <Kbd>?</Kbd> any time to open this cheat sheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <Section title="Anywhere">
            <Row keys={[`${mod}`, 'K']}>Open command palette</Row>
            <Row keys={['?']}>This cheat sheet</Row>
            <Row keys={['Esc']}>Close any dialog or clear selection</Row>
          </Section>

          <Section title="Tasks">
            <Row keys={['Click row checkbox']}>Select tasks for bulk action</Row>
            <Row keys={['Esc']}>Clear selected tasks</Row>
          </Section>

          <Section title="Subtasks (inside the task dialog)">
            <Row keys={['Tab']}>Focus a subtask row</Row>
            <Row keys={[mod, '↑']}>Move focused subtask up</Row>
            <Row keys={[mod, '↓']}>Move focused subtask down</Row>
            <Row keys={['Drag the grip']}>Reorder via mouse</Row>
          </Section>

          <Section title="Tracking map (canvas tab + full-screen)">
            <Row keys={['n']}>Add a node</Row>
            <Row keys={['/']}>Search nodes</Row>
            <Row keys={['Del']}>Delete the selected node or edge</Row>
            <Row keys={['Drag']}>Position a node</Row>
            <Row keys={['Drag handle']}>Connect two nodes</Row>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-1.5 text-sm">{children}</ul>
    </div>
  );
}

function Row({
  keys,
  children,
}: {
  keys: string[];
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="text-foreground/90">{children}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-xs text-muted-foreground">+</span>
            )}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </span>
    </li>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] text-foreground">
      {children}
    </kbd>
  );
}
