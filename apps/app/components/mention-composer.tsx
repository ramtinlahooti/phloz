'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type MentionMember = {
  id: string;
  /** Cached display name from `workspace_members.display_name`. */
  displayName: string | null;
  /** Cached email from `workspace_members.email`. The composer
   *  inserts `@<email>` on select so the existing parser in
   *  createCommentAction resolves the mention without ambiguity. */
  email: string | null;
};

type MentionState = {
  /** True when the dropdown is open (the user typed `@` and is
   *  still in a token without a closing space). */
  active: boolean;
  /** Everything after the `@` up to the caret. */
  query: string;
  /** Index of the `@` character in `value`. -1 when inactive. */
  anchor: number;
  /** Highlighted row in the dropdown — Enter / Tab insert this one. */
  selectedIndex: number;
};

const MAX_RESULTS = 6;

/**
 * Textarea wrapped with an `@`-mention autocomplete. Same look + feel
 * as the bare `<textarea>` it replaces, plus a popover that filters
 * workspace members as the user types after a `@`.
 *
 * Selection rule: highlight + Enter / Tab inserts `@<email>`. The
 * existing comment-action parser (`createCommentAction`) then
 * resolves the email to a workspace_members.id, populates
 * `comments.mentions`, and fans out the notification email. So this
 * component is purely the input layer — the canonical mention
 * resolution still lives server-side.
 *
 * Keyboard:
 *  - `@` opens the popover (or any subsequent character that grows
 *    the in-progress token after a `@`).
 *  - `↑` / `↓` move the highlight.
 *  - `Enter` / `Tab` insert the highlighted member.
 *  - `Esc` closes the popover without inserting.
 *  - Whitespace closes it without inserting (the user typed past
 *    the mention).
 *
 * Falls through to plain textarea when no `@` is in flight.
 */
export function MentionComposer({
  value,
  onChange,
  members,
  placeholder,
  rows = 3,
  maxLength,
  disabled,
  className,
  onKeyDown,
  onSubmitShortcut,
}: {
  value: string;
  onChange: (next: string) => void;
  members: MentionMember[];
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
  /** Pass-through to the underlying textarea so the parent can
   *  layer extra keybindings (Cmd+Enter to submit, etc.). The
   *  composer's own dropdown navigation runs first; only events the
   *  composer doesn't handle reach this. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Convenience hook fired on Cmd/Ctrl+Enter when the dropdown is
   *  closed — saves the parent from re-implementing the chord. */
  onSubmitShortcut?: () => void;
  className?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [state, setState] = useState<MentionState>({
    active: false,
    query: '',
    anchor: -1,
    selectedIndex: 0,
  });
  const popoverId = useId();

  // Compute matches every time the query changes. Match against
  // email (case-insensitive) + displayName (case-insensitive).
  // Empty query lists the most-recent members.
  const matches = useMemo(() => {
    if (!state.active) return [];
    const q = state.query.toLowerCase();
    const filtered =
      q.length === 0
        ? members
        : members.filter((m) => {
            const hay = `${m.email ?? ''} ${m.displayName ?? ''}`.toLowerCase();
            return hay.includes(q);
          });
    return filtered.slice(0, MAX_RESULTS);
  }, [members, state.active, state.query]);

  // Reset highlight when matches change shape (e.g. after typing).
  useEffect(() => {
    setState((s) =>
      s.active && s.selectedIndex >= matches.length
        ? { ...s, selectedIndex: Math.max(0, matches.length - 1) }
        : s,
    );
  }, [matches.length]);

  function close() {
    setState({ active: false, query: '', anchor: -1, selectedIndex: 0 });
  }

  function applyValue(nextValue: string, caret: number) {
    onChange(nextValue);
    // Re-focus + restore caret after React commits.
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  }

  function insertMention(member: MentionMember) {
    if (!state.active || state.anchor < 0) return;
    const insert = `@${member.email ?? member.displayName ?? member.id} `;
    const before = value.slice(0, state.anchor);
    // Skip past the @ + the in-progress token to find where the
    // user's typing left off.
    const afterStart = state.anchor + 1 + state.query.length;
    const after = value.slice(afterStart);
    const next = `${before}${insert}${after}`;
    const caret = before.length + insert.length;
    applyValue(next, caret);
    close();
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    // Re-derive mention state from the new caret position. The
    // textarea's selectionStart is already updated by the time the
    // change event fires.
    const caret = e.target.selectionStart ?? next.length;
    deriveMentionState(next, caret);
  }

  function handleSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    // Caret moved without a value change (arrow keys, click). Re-
    // derive so the popover follows.
    const ta = e.currentTarget;
    deriveMentionState(ta.value, ta.selectionStart ?? ta.value.length);
  }

  function deriveMentionState(next: string, caret: number) {
    // Walk backward from the caret looking for an `@`. If we hit
    // whitespace first, the caret isn't inside a mention token.
    let i = caret - 1;
    while (i >= 0) {
      const ch = next[i]!;
      if (ch === '@') {
        // The `@` must be at start-of-string OR preceded by
        // whitespace (matches the existing
        // `(?<!\w)@<token>` parser).
        const before = i > 0 ? next[i - 1] : '';
        if (i > 0 && /\w/.test(before ?? '')) {
          close();
          return;
        }
        const query = next.slice(i + 1, caret);
        // Limit the in-progress token to characters the parser
        // accepts; whitespace closes the popover.
        if (/\s/.test(query)) {
          close();
          return;
        }
        setState((s) => ({
          ...s,
          active: true,
          query,
          anchor: i,
          // Reset highlight on new tokens; arrow keys then move.
          selectedIndex: 0,
        }));
        return;
      }
      if (/\s/.test(ch)) break;
      i -= 1;
    }
    // Caret isn't inside an `@<token>` — close.
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (state.active && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setState((s) => ({
          ...s,
          selectedIndex: (s.selectedIndex + 1) % matches.length,
        }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setState((s) => ({
          ...s,
          selectedIndex:
            (s.selectedIndex - 1 + matches.length) % matches.length,
        }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const member = matches[state.selectedIndex];
        if (member) {
          e.preventDefault();
          insertMention(member);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
    }
    if (
      onSubmitShortcut &&
      e.key === 'Enter' &&
      (e.metaKey || e.ctrlKey) &&
      !state.active
    ) {
      e.preventDefault();
      onSubmitShortcut();
      return;
    }
    onKeyDown?.(e);
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        aria-autocomplete="list"
        aria-controls={state.active ? popoverId : undefined}
        aria-expanded={state.active}
        className={
          className ??
          'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm'
        }
      />
      {state.active && matches.length > 0 && (
        <ul
          id={popoverId}
          role="listbox"
          className="absolute left-2 top-full z-20 mt-1 max-h-56 w-72 max-w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md"
        >
          {matches.map((m, idx) => {
            const selected = idx === state.selectedIndex;
            const label = m.displayName?.trim() || m.email || m.id.slice(0, 8);
            return (
              <li
                key={m.id}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  // mousedown so focus stays with the textarea — a
                  // click would blur first and dismiss the popover
                  // before the insertion runs.
                  e.preventDefault();
                  insertMention(m);
                }}
                onMouseEnter={() =>
                  setState((s) => ({ ...s, selectedIndex: idx }))
                }
                className={`flex cursor-pointer flex-col rounded-sm px-2 py-1.5 ${
                  selected ? 'bg-primary/10 text-foreground' : ''
                }`}
              >
                <span className="text-foreground">{label}</span>
                {m.email && m.displayName && m.email !== m.displayName && (
                  <span className="text-[11px] text-muted-foreground">
                    {m.email}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
