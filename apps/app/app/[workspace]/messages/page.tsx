import { Card, CardContent } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Messages' });

export default function MessagesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Email threads + internal comments across every client.
        </p>
      </header>

      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">
          The unified inbox (email threads forwarded to client inbound
          addresses, internal @-mentions, deliverable threads) ships in a
          follow-up session. The Resend inbound webhook endpoint is already
          live at <code className="font-mono">/api/webhooks/resend/inbound</code>.
        </CardContent>
      </Card>
    </div>
  );
}
