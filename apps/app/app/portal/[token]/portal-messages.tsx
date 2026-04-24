'use client';

import { Mail, MessageSquare, Send } from 'lucide-react';
import { useState, useTransition } from 'react';

import type { MessageChannel, MessageDirection } from '@phloz/config';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  toast,
} from '@phloz/ui';

import { sendPortalReplyAction } from './actions';

export type PortalMessage = {
  id: string;
  threadId: string;
  direction: MessageDirection;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  createdAt: Date;
};

type Thread = {
  threadId: string;
  messages: PortalMessage[];
};

/**
 * Messages + inline reply on the client portal. Groups messages by
 * threadId, most recently active thread first. Each thread has a
 * "Reply" button that expands to a textarea; submitting calls
 * `sendPortalReplyAction` which creates an inbound portal-channel
 * message threaded against the same `threadId`.
 *
 * A compose-new-thread box below the threads lets clients start a
 * fresh conversation rather than always replying to the latest email.
 */
export function PortalMessages({
  token,
  messages,
}: {
  token: string;
  messages: PortalMessage[];
}) {
  const threads = groupThreads(messages);

  return (
    <div className="space-y-4">
      {threads.map((t) => (
        <ThreadCard key={t.threadId} token={token} thread={t} />
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Start a new conversation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ReplyForm token={token} threadId={undefined} placeholder="Write a note to your agency…" />
        </CardContent>
      </Card>
    </div>
  );
}

function ThreadCard({ token, thread }: { token: string; thread: Thread }) {
  const latest = thread.messages[thread.messages.length - 1]!;
  const [replyOpen, setReplyOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2">
            <ChannelIcon channel={latest.channel} />
            <span className="truncate">
              {latest.subject ?? '(no subject)'}
            </span>
          </span>
          <time
            className="shrink-0 text-xs text-muted-foreground"
            dateTime={latest.createdAt.toISOString()}
          >
            {latest.createdAt.toLocaleDateString()}
          </time>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-md p-3 text-sm ${
              m.direction === 'inbound'
                ? 'border border-primary/40 bg-primary/5'
                : 'border border-border bg-card/50'
            }`}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <ChannelIcon channel={m.channel} />
              <span>
                {m.direction === 'inbound' ? 'You' : 'Agency'}
              </span>
              <span aria-hidden>·</span>
              <time dateTime={m.createdAt.toISOString()}>
                {m.createdAt.toLocaleString()}
              </time>
              {m.direction === 'inbound' && m.channel === 'portal' && (
                <Badge variant="outline" className="text-[10px]">
                  Portal
                </Badge>
              )}
            </div>
            <p className="whitespace-pre-wrap text-foreground/90">{m.body}</p>
          </div>
        ))}

        {replyOpen ? (
          <ReplyForm
            token={token}
            threadId={thread.threadId}
            placeholder="Write your reply…"
            onCancel={() => setReplyOpen(false)}
          />
        ) : (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplyOpen(true)}
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              Reply
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReplyForm({
  token,
  threadId,
  placeholder,
  onCancel,
}: {
  token: string;
  threadId: string | undefined;
  placeholder: string;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState('');
  const [, startTransition] = useTransition();
  const [sending, setSending] = useState(false);

  function submit() {
    if (!body.trim()) return;
    setSending(true);
    startTransition(async () => {
      const res = await sendPortalReplyAction({
        token,
        threadId,
        body: body.trim(),
      });
      setSending(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Sent');
      setBody('');
      onCancel?.();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-2"
    >
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={sending}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={sending || !body.trim()}
          className="gap-1.5"
        >
          <Send className="size-3.5" />
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </form>
  );
}

function ChannelIcon({ channel }: { channel: MessageChannel }) {
  if (channel === 'email')
    return <Mail className="size-3.5 text-muted-foreground" />;
  return <MessageSquare className="size-3.5 text-muted-foreground" />;
}

function groupThreads(messages: PortalMessage[]): Thread[] {
  const byThread = new Map<string, PortalMessage[]>();
  for (const m of messages) {
    if (!byThread.has(m.threadId)) byThread.set(m.threadId, []);
    byThread.get(m.threadId)!.push(m);
  }
  return Array.from(byThread.entries())
    .map(([threadId, msgs]) => ({
      threadId,
      messages: msgs.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      ),
    }))
    .sort((a, b) => {
      const aLast = a.messages[a.messages.length - 1]!.createdAt.getTime();
      const bLast = b.messages[b.messages.length - 1]!.createdAt.getTime();
      return bLast - aLast;
    });
}
