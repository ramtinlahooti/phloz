import { NextResponse } from 'next/server';
import { z } from 'zod';

import { switchWorkspace } from '@phloz/auth/workspace-switch';
import { requireUser } from '@phloz/auth/session';

const bodySchema = z.object({ workspaceId: z.string().uuid() });

/**
 * POST /api/workspaces/switch
 * Body: { workspaceId: string }
 *
 * Updates the user's `user_metadata.active_workspace_id` so the next
 * JWT refresh (via the custom access token hook) picks up the change.
 */
export async function POST(request: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    await switchWorkspace(parsed.data.workspaceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
