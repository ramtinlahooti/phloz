import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { requireRole } from '@phloz/auth/roles';
import { getDb, schema } from '@phloz/db/client';

import { csvResponseHeaders, toCsv, type CsvRow } from '@/lib/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Clients CSV export. Owner/admin/member only (viewers don't get to
 * pull data out even though they can read it — keeps bulk exports
 * behind the same gate as any mutation).
 *
 * Query params:
 *   - `q` — optional substring filter; matches name / business_name /
 *     industry / website_url / business_email. Mirrors the in-app
 *     search so "Export what I'm looking at" is predictable.
 *   - `includeArchived` — `"true"` to include archived clients; default
 *     is active only.
 *
 * No rate limiting yet. If this gets abused, add a per-workspace
 * counter (Supabase edge function or Upstash Redis).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  try {
    await requireRole(workspaceId, ['owner', 'admin', 'member']);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const includeArchived = url.searchParams.get('includeArchived') === 'true';

  const db = getDb();
  const rows = await db
    .select()
    .from(schema.clients)
    .where(eq(schema.clients.workspaceId, workspaceId))
    .orderBy(desc(schema.clients.updatedAt));

  const filtered = rows.filter((c) => {
    if (!includeArchived && c.archivedAt !== null) return false;
    if (q) {
      const hay = [
        c.name,
        c.businessName,
        c.industry,
        c.websiteUrl,
        c.businessEmail,
      ]
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Columns chosen for "useful in a spreadsheet". We deliberately omit
  // internal JSONB (settings, geo_targeting, custom_fields) — they'd
  // serialise as unreadable JSON and an agency exporting to share with
  // a stakeholder doesn't want that noise. If someone needs the raw
  // data, SQL-via-Supabase is the right channel.
  const csvRows: CsvRow[] = filtered.map((c) => ({
    id: c.id,
    name: c.name,
    business_name: c.businessName,
    business_email: c.businessEmail,
    business_phone: c.businessPhone,
    website_url: c.websiteUrl,
    industry: c.industry,
    company_size: c.companySize,
    company_budget: c.companyBudget,
    target_cpa: c.targetCpa,
    notes: c.notes,
    archived: c.archivedAt !== null ? 'true' : 'false',
    archived_at: c.archivedAt,
    last_activity_at: c.lastActivityAt,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }));

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(csvRows), {
    status: 200,
    headers: csvResponseHeaders(`phloz-clients-${today}`),
  });
}
