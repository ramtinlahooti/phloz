import { getDb, getPgClient } from '../client';
import {
  clients,
  trackingEdges,
  trackingNodes,
  workspaceMembers,
  workspaces,
} from '../schema';

/**
 * Minimal seed: one workspace, one owner, two clients, three tracking nodes,
 * two edges. Enough to demo the map + client list without touching Stripe or
 * Supabase Auth.
 *
 * The owner user id is hardcoded. In local dev, create a matching auth.users
 * row via Supabase Studio before running, or bypass RLS using the service
 * role (which `getDb()` already does when DATABASE_URL points at the service
 * role connection string).
 */
const SEED_OWNER_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const db = getDb();

  // eslint-disable-next-line no-console
  console.warn('[seed] inserting demo workspace');

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: 'Demo Agency',
      slug: 'demo-agency',
      ownerUserId: SEED_OWNER_ID,
      tier: 'starter',
      settings: { all_members_see_all_clients: true },
    })
    .returning();

  if (!workspace) throw new Error('Failed to insert demo workspace');

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: SEED_OWNER_ID,
    role: 'owner',
    displayName: 'Demo Owner',
    email: 'owner@demo-agency.local',
    acceptedAt: new Date(),
  });

  const [acme, beta] = await db
    .insert(clients)
    .values([
      {
        workspaceId: workspace.id,
        name: 'Acme Inc',
        industry: 'ecommerce',
        websiteUrl: 'https://acme.example.com',
      },
      {
        workspaceId: workspace.id,
        name: 'Beta Co',
        industry: 'b2b-saas',
        websiteUrl: 'https://beta.example.com',
      },
    ])
    .returning();

  if (!acme) throw new Error('Failed to insert demo client');

  const nodes = await db
    .insert(trackingNodes)
    .values([
      {
        workspaceId: workspace.id,
        clientId: acme.id,
        nodeType: 'website',
        label: 'acme.example.com',
        metadata: { url: 'https://acme.example.com' },
        position: { x: 0, y: 0 },
        healthStatus: 'working',
      },
      {
        workspaceId: workspace.id,
        clientId: acme.id,
        nodeType: 'gtm_container',
        label: 'GTM-ACME123',
        metadata: { containerId: 'GTM-ACME123' },
        position: { x: 240, y: 0 },
        healthStatus: 'working',
      },
      {
        workspaceId: workspace.id,
        clientId: acme.id,
        nodeType: 'ga4_property',
        label: 'Acme GA4',
        metadata: { propertyId: '123456789', healthStatus: 'working' },
        position: { x: 480, y: 0 },
        healthStatus: 'working',
      },
    ])
    .returning();

  if (nodes.length < 3) throw new Error('Failed to insert demo nodes');

  await db.insert(trackingEdges).values([
    {
      workspaceId: workspace.id,
      clientId: acme.id,
      sourceNodeId: nodes[0]!.id,
      targetNodeId: nodes[1]!.id,
      edgeType: 'uses_data_layer',
    },
    {
      workspaceId: workspace.id,
      clientId: acme.id,
      sourceNodeId: nodes[1]!.id,
      targetNodeId: nodes[2]!.id,
      edgeType: 'sends_events_to',
    },
  ]);

  // eslint-disable-next-line no-console
  console.warn(`[seed] done — workspace ${workspace.slug}, clients ${acme.id}, ${beta?.id ?? ''}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await getPgClient().end();
  });
