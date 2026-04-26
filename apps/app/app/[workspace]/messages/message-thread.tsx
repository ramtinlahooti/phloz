'use client';

import { Mail, MessageSquare, StickyNote } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { MessageChannel, MessageDirection } from '@phloz/config';
import {
  Badge,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from '@phloz/ui';

import {
  postInternalNoteAction,
  sendEmailReplyAction,
} from './actions';

export type MessageItem = {
  id: string;
  threadId: string;
  direction: MessageDirection;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  fromLabel: string;
  createdAt: Date;
};

/**
 * Per-client message feed. Renders the messages in chronological order
 * within their `threadId`, then provides a Reply / Internal Note pane
 * at the bottom. Channel selector lets the team pick between emailing
 * the client and logging a team-only note.
 */
export function MessageThread({
  workspaceId,
  clientId,
  clientEmail,
  inboundAddress,
  messages,
}: {
  workspaceId: string;
  clientId: string;
  clientEmail: string | null;
  inboundAddress: string | null;
  messages: MessageItem[];
}) {
  // Group by threadId to show multiple conversations.
  const threads = groupThreads(messages);

  return (
    <div className="space-y-6">
      {inboundAddress && (
        <div className="rounded-md border border-border bg-card/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Forwarding address for this client:
          </span>{' '}
          <code className="font-mono text-foreground">{inboundAddress}</code>
          <span className="ml-2 text-muted-foreground">
            Forward any client email here and it auto-threads.
          </span>
        </div>
      )}

      {threads.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">
          No messages yet. Send an email reply below or post an internal note.
        </p>
      ) : (
        <div className="space-y-8">
          {threads.map((t, idx) => (
            <section key={t.threadId}>
              {threads.length > 1 && (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Thread {idx + 1}
                </h3>
              )}
              <ul className="space-y-2">
                {t.messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ComposeForm
        workspaceId={workspaceId}
        clientId={clientId}
        clientEmail={clientEmail}
        defaultSubject={threads[0]?.messages[0]?.subject ?? null}
        threadId={threads[0]?.threadId ?? undefined}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: MessageItem }) {
  const isNote = message.channel === 'internal_note';
  const isOutbound = message.direction === 'outbound';

  return (
    <li
      className={`rounded-lg border p-4 text-sm ${
        isNote
          ? 'border-amber-400/30 bg-amber-400/5'
          : isOutbound
            ? 'border-primary/40 bg-primary/5'
            : 'border-border bg-card/30'
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <ChannelIcon channel={message.channel} />
        <span className="font-medium text-foreground">{message.fromLabel}</span>
        <Badge
          variant="outline"
          className="text-[10px] capitalize"
        >
          {message.direction}
        </Badge>
        {isNote && (
          <Badge variant="outline" className="border-amber-400/50 text-[10px] text-amber-400">
            Internal
          </Badge>
        )}
        <span aria-hidden>·</span>
        <time dateTime={message.createdAt.toISOString()}>
          {message.createdAt.toLocaleString()}
        </time>
      </div>
      {message.subject && message.channel === 'email' && (
        <div className="mb-1 font-medium">{message.subject}</div>
      )}
      <div className="whitespace-pre-wrap text-foreground/90">
        {message.body}
      </div>
    </li>
  );
}

function ChannelIcon({ channel }: { channel: MessageChannel }) {
  if (channel === 'email')
    return <Mail className="size-3.5" aria-label="email" />;
  if (channel === 'internal_note')
    return <StickyNote className="size-3.5 text-amber-400" aria-label="internal note" />;
  return <MessageSquare className="size-3.5" aria-label="portal" />;
}

function ComposeForm({
  workspaceId,
  clientId,
  clientEmail,
  defaultSubject,
  threadId,
}: {
  workspaceId: string;
  clientId: string;
  clientEmail: string | null;
  defaultSubject: string | null;
  threadId?: string;
}) {
  const [mode, setMode] = useState<'email' | 'note'>(
    clientEmail ? 'email' : 'note',
  );
  const [subject, setSubject] = useState(
    defaultSubject ? `Re: ${defaultSubject.replace(/^re:\s*/i, '')}` : '',
  );
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);

  // Per-(workspace, client, mode) draft key. Separate slot for email
  // vs internal note so a half-written reply doesn't get clobbered
  // when the user toggles the tab to jot a quick note.
  const draftKey = `phloz.draft.${workspaceId}.${clientId}.${mode}`;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore-on-mount + on tab switch. Only swaps the body in when
  // it's currently empty so we don't overwrite an in-progress edit
  // that started before the restore returned.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(draftKey);
      if (stored && stored.trim().length > 0) {
        setBody((prev) => (prev.length === 0 ? stored : prev));
        setRestoredDraft(true);
      } else {
        setRestoredDraft(false);
      }
    } catch {
      // Ignore — Safari private mode + storage quota errors fall
      // through to "no draft restored", which is fine.
    }
    // Re-runs when the (workspace, client, mode) draft key changes;
    // we intentionally don't depend on `body` so the restore only
    // fires once per key.
  }, [draftKey]);

  // Debounced auto-save. 500ms keeps the disk-write rate sane while
  // still feeling instant when the user pauses typing. Empty bodies
  // remove the key entirely so the next mount doesn't restore a
  // stale "" draft.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      try {
        if (body.length === 0) {
          window.localStorage.removeItem(draftKey);
        } else {
          window.localStorage.setItem(draftKey, body);
        }
      } catch {
        // Quota / permissions errors are non-fatal.
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [body, draftKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      if (mode === 'email') {
        if (!clientEmail) {
          toast.error('Add a business email to this client first.');
          return;
        }
        const res = await sendEmailReplyAction({
          workspaceId,
          clientId,
          to: clientEmail,
          subject: subject.trim() || '(no subject)',
          body: body.trim(),
          threadId,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Email sent');
      } else {
        const res = await postInternalNoteAction({
          workspaceId,
          clientId,
          body: body.trim(),
          threadId,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success('Note posted');
      }
      setBody('');
      setRestoredDraft(false);
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        // Non-fatal.
      }
    } finally {
      setSending(false);
    }
  }

  function clearDraft() {
    setBody('');
    setRestoredDraft(false);
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Non-fatal.
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-border bg-card/30 p-4"
    >
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as 'email' | 'note')}
        className="mb-3"
      >
        <TabsList>
          <TabsTrigger value="email" disabled={!clientEmail}>
            Email
          </TabsTrigger>
          <TabsTrigger value="note">Internal note</TabsTrigger>
        </TabsList>
        <TabsContent value="email" className="pt-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>To:</span>
              <span className="font-mono text-foreground">
                {clientEmail ?? '—'}
              </span>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            />
          </div>
        </TabsContent>
        <TabsContent value="note" className="pt-3">
          <p className="text-xs text-muted-foreground">
            Visible to your team only — not emailed, not shown in the portal.
          </p>
        </TabsContent>
      </Tabs>

      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          if (restoredDraft) setRestoredDraft(false);
        }}
        rows={4}
        placeholder={
          mode === 'email'
            ? 'Write your reply…'
            : 'Jot down a team-only note…'
        }
        className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-[11px] text-muted-foreground">
          {restoredDraft ? (
            <span className="flex items-center gap-2">
              Draft restored
              <button
                type="button"
                onClick={clearDraft}
                className="underline-offset-2 hover:underline"
              >
                Clear
              </button>
            </span>
          ) : body.length > 0 ? (
            <span>Draft saved locally</span>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
        <Button type="submit" size="sm" disabled={sending || !body.trim()}>
          {sending
            ? mode === 'email'
              ? 'Sending…'
              : 'Posting…'
            : mode === 'email'
              ? 'Send email'
              : 'Post note'}
        </Button>
      </div>
    </form>
  );
}

function groupThreads(
  messages: MessageItem[],
): { threadId: string; messages: MessageItem[] }[] {
  const byThread = new Map<string, MessageItem[]>();
  for (const m of messages) {
    if (!byThread.has(m.threadId)) byThread.set(m.threadId, []);
    byThread.get(m.threadId)!.push(m);
  }
  return Array.from(byThread.entries())
    .map(([threadId, items]) => ({
      threadId,
      messages: items.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      ),
    }))
    .sort((a, b) => {
      // Most recent thread last updated goes first.
      const aLast = a.messages[a.messages.length - 1]!.createdAt.getTime();
      const bLast = b.messages[b.messages.length - 1]!.createdAt.getTime();
      return bLast - aLast;
    });
}
