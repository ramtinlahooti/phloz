'use client';

import { useState } from 'react';

import { Button, Input } from '@phloz/ui';

import { SITE_CONFIG } from '@/lib/site-config';

/**
 * Newsletter signup form. Posts cross-origin to
 * `${SITE_CONFIG.appUrl}/api/newsletter/subscribe`, which runs on the
 * product app (where DB + env vars live). The API handler is
 * idempotent — resubmitting the same email is a no-op.
 *
 * Analytics: the `newsletter_signup` event fires server-side inside
 * the API handler (one write, one event). We don't double-fire client
 * side because the browser side of `track()` is anonymous and would
 * land under a different distinctId than the server event.
 *
 * UX: shows a success message inline after subscribe; errors from the
 * server are surfaced in a small red line below the input. No toast
 * library import here — keeps the marketing bundle lean.
 */
export function NewsletterForm({
  source,
  variant = 'default',
  placeholder = 'you@agency.com',
  submitLabel = 'Subscribe',
  successMessage = 'Thanks! Check your inbox soon.',
}: {
  /** Required. Identifies where the signup happened for analytics +
   *  segmentation. Examples: `homepage_bottom`, `blog_footer`. */
  source: string;
  /** `default` = stacked on mobile / inline on sm+.
   *  `compact` = inline at every width, smaller input. */
  variant?: 'default' | 'compact';
  placeholder?: string;
  submitLabel?: string;
  successMessage?: string;
}) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'submitting' }
    | { kind: 'success' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setState({ kind: 'error', message: 'Enter a valid email.' });
      return;
    }
    setState({ kind: 'submitting' });
    try {
      const res = await fetch(
        `${SITE_CONFIG.appUrl}/api/newsletter/subscribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, source }),
        },
      );
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: 'unknown' as const }));
        const message =
          body.error === 'invalid_email'
            ? 'That email doesn\'t look right.'
            : 'Could not subscribe. Please try again.';
        setState({ kind: 'error', message });
        return;
      }
      setState({ kind: 'success' });
      setEmail('');
    } catch {
      setState({
        kind: 'error',
        message: 'Could not reach the server. Try again in a moment.',
      });
    }
  }

  const isCompact = variant === 'compact';
  const buttonSize = isCompact ? 'sm' : 'md';
  // Input has no `size` prop (it's a plain HTMLInputElement, `size`
  // there would be the native char-width attribute). Use className
  // overrides for the compact variant instead.
  const inputClass = isCompact ? 'h-8 text-xs' : '';

  if (state.kind === 'success') {
    return (
      <p
        role="status"
        className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground"
      >
        {successMessage}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={
        isCompact
          ? 'flex gap-2'
          : 'flex flex-col gap-2 sm:flex-row sm:items-center'
      }
      noValidate
    >
      <label htmlFor={`newsletter-${source}-email`} className="sr-only">
        Email
      </label>
      <Input
        id={`newsletter-${source}-email`}
        type="email"
        autoComplete="email"
        placeholder={placeholder}
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (state.kind === 'error') setState({ kind: 'idle' });
        }}
        disabled={state.kind === 'submitting'}
        aria-invalid={state.kind === 'error'}
        aria-describedby={
          state.kind === 'error' ? `newsletter-${source}-error` : undefined
        }
        className={`flex-1 ${inputClass}`.trim()}
      />
      <Button
        type="submit"
        size={buttonSize}
        disabled={state.kind === 'submitting'}
      >
        {state.kind === 'submitting' ? 'Subscribing…' : submitLabel}
      </Button>
      {state.kind === 'error' && (
        <p
          id={`newsletter-${source}-error`}
          className="w-full text-xs text-[var(--color-destructive)] sm:basis-full"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
