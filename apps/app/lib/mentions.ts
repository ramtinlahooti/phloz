import { eq } from 'drizzle-orm';

import { getDb, schema } from '@phloz/db/client';

/**
 * Extract `@<token>` mentions from a comment / note body. Tokens
 * are alphanumeric + dot + hyphen + plus + at (covers email
 * local-parts, full addresses, and dotted display-names). Tokens
 * are de-duplicated + lowercased. Capped at 50 to defend against
 * pathological pastes.
 */
export function extractMentionTokens(body: string): string[] {
  const re = /@([\w.\-+@]+)/g;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(re)) {
    const token = m[1]?.toLowerCase();
    if (!token) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= 50) break;
  }
  return out;
}

export type ResolvedMention = {
  /** workspace_members.id of the matched member. */
  membershipId: string;
  /** Cached email — non-null on every match (we resolve via email). */
  email: string;
  /** Cached display name, or null if the member never set one. */
  displayName: string | null;
  /** Cached user_id — null when the invite hasn't been accepted yet. */
  userId: string | null;
};

/**
 * Resolve `@<token>` strings to workspace members.
 *
 * Match strategy: extract every `@<token>` and try to resolve each
 * token to a workspace member via two paths:
 *
 *   1. Email exact match (case-insensitive) — the user typed the
 *      full address.
 *   2. Email local-part match — `@alex` matches `alex@agency.com`
 *      so people don't have to type the full address.
 *
 * Display-name matching is skipped to keep ambiguity manageable;
 * the `MentionComposer` autocomplete inserts canonical emails
 * before the regex sees them, and free-typed mentions fall back
 * to the local-part heuristic above.
 *
 * Single fetch of every workspace member; per-workspace headcount
 * is small enough that JS filtering is cheaper than building a
 * SQL `OR` chain.
 */
export async function resolveMentionTokens(input: {
  workspaceId: string;
  tokens: string[];
}): Promise<ResolvedMention[]> {
  if (input.tokens.length === 0) return [];

  const db = getDb();
  const members = await db
    .select({
      id: schema.workspaceMembers.id,
      userId: schema.workspaceMembers.userId,
      email: schema.workspaceMembers.email,
      displayName: schema.workspaceMembers.displayName,
    })
    .from(schema.workspaceMembers)
    .where(eq(schema.workspaceMembers.workspaceId, input.workspaceId));

  const lowered = new Set(input.tokens.map((t) => t.toLowerCase()));
  const matches: ResolvedMention[] = [];
  for (const m of members) {
    if (!m.email) continue;
    const lc = m.email.toLowerCase();
    const local = lc.split('@')[0];
    const hit =
      lowered.has(lc) || (local !== undefined && lowered.has(local));
    if (!hit) continue;
    matches.push({
      membershipId: m.id,
      email: m.email,
      displayName: m.displayName,
      userId: m.userId,
    });
  }
  return matches;
}
