'use client';

import { useEffect, useRef } from 'react';

/**
 * Invisible keyboard layer for the messages inbox. Listens for:
 *   - `j` / `k` — step through the rendered rows
 *   - `Enter` / `o` — open the focused row's link
 *   - `s` — toggle the star on the focused row
 *
 * Uses DOM queries against `[data-inbox-row]` markers so the rows
 * themselves stay server-rendered — no need to lift the list
 * rendering into a client component.
 *
 * Skipped when typing in inputs / textareas / contentEditable, so
 * the search input on the same page is unaffected.
 *
 * Why a separate component vs. extending the global keyboard
 * shortcuts dialog: the navigation is page-scoped (only meaningful
 * on the inbox), and the focus + scroll behaviour is best handled
 * with a local ref to the focused id.
 */
export function InboxKeyboardNav() {
  const focusedIdRef = useRef<string | null>(null);

  useEffect(() => {
    function rows(): HTMLElement[] {
      return Array.from(
        document.querySelectorAll<HTMLElement>('[data-inbox-row]'),
      );
    }

    function setFocus(id: string | null) {
      const all = rows();
      for (const el of all) {
        if (el.dataset.inboxRow === id) {
          el.dataset.focused = 'true';
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          delete el.dataset.focused;
        }
      }
      focusedIdRef.current = id;
    }

    function step(delta: -1 | 1) {
      const all = rows();
      if (all.length === 0) return;
      const ids = all.map((el) => el.dataset.inboxRow ?? '');
      const current = focusedIdRef.current;
      if (current === null) {
        const firstId = ids[delta === 1 ? 0 : ids.length - 1] ?? null;
        if (firstId) setFocus(firstId);
        return;
      }
      const idx = ids.indexOf(current);
      if (idx === -1) {
        setFocus(ids[0] ?? null);
        return;
      }
      const next = ids[Math.min(ids.length - 1, Math.max(0, idx + delta))];
      if (next && next !== current) setFocus(next);
    }

    function openCurrent() {
      const id = focusedIdRef.current;
      if (!id) return;
      const el = document.querySelector<HTMLElement>(
        `[data-inbox-row="${CSS.escape(id)}"]`,
      );
      const link = el?.querySelector<HTMLAnchorElement>('a');
      if (link) link.click();
    }

    function toggleStarCurrent() {
      const id = focusedIdRef.current;
      if (!id) return;
      const el = document.querySelector<HTMLElement>(
        `[data-inbox-row="${CSS.escape(id)}"]`,
      );
      // The star is the only button inside the row markup; query
      // for the first <button> rather than introducing a new
      // selector contract to the DOM.
      const button = el?.querySelector<HTMLButtonElement>('button');
      if (button) button.click();
    }

    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'j') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'k') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'Enter' || e.key === 'o') {
        if (focusedIdRef.current) {
          e.preventDefault();
          openCurrent();
        }
      } else if (e.key === 's') {
        if (focusedIdRef.current) {
          e.preventDefault();
          toggleStarCurrent();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
