import { Card, CardContent, CardHeader, CardTitle } from '@phloz/ui';

import { buildAppMetadata } from '@/lib/metadata';

export const metadata = buildAppMetadata({ title: 'Client portal' });

export default function PortalHomePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See the latest updates, approvals, and deliverables from your
          agency.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent updates</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nothing here yet. Your agency will share updates, tasks, and
          approvals in this portal.
        </CardContent>
      </Card>
    </div>
  );
}
