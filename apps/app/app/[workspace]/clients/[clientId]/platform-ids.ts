import type { NodeType } from '@phloz/config';

/**
 * One-click reference of every platform ID this client has. Pulled
 * out of the tracking_nodes metadata — that's the source of truth.
 * If a client has two GA4 properties or two GTM containers, both
 * appear so the user can pick the right one.
 *
 * Per-row shape:
 *  - `label`: short, scannable ("GTM container", "Meta Pixel ID")
 *  - `value`: the literal id (the thing that gets copied)
 *  - `nodeId`: optional — used by the card's "View" link to focus
 *     the right node on the tracking map
 */
export type PlatformIdRow = {
  label: string;
  value: string;
  nodeId?: string;
};

type IdNode = {
  id: string;
  nodeType: NodeType;
  label: string | null;
  metadata: Record<string, unknown> | null;
};

const STR = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

const ARR = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(STR).filter((s): s is string => s !== null) : [];

/**
 * Extract every recognisable platform ID from a node's metadata.
 * Adding a new mapping is a single switch case — keep this in sync
 * when a new node type with an ID field is registered in
 * `packages/tracking-map/src/node-types/`.
 */
function extractIds(node: IdNode): PlatformIdRow[] {
  const meta = node.metadata ?? {};
  const labelSuffix = node.label ? ` (${node.label})` : '';
  const out: PlatformIdRow[] = [];

  switch (node.nodeType) {
    case 'gtm_container': {
      const id = STR(meta.containerId);
      if (id) out.push({ label: `GTM container${labelSuffix}`, value: id, nodeId: node.id });
      break;
    }
    case 'gtm_server_container': {
      const id = STR(meta.containerId);
      if (id) out.push({ label: `GTM server container${labelSuffix}`, value: id, nodeId: node.id });
      break;
    }
    case 'ga4_property': {
      for (const id of ARR(meta.measurementIds)) {
        out.push({ label: `GA4 measurement ID${labelSuffix}`, value: id, nodeId: node.id });
      }
      break;
    }
    case 'ga4_data_stream': {
      const measurement = STR(meta.measurementId);
      const stream = STR(meta.streamId);
      if (measurement) {
        out.push({
          label: `GA4 measurement ID${labelSuffix}`,
          value: measurement,
          nodeId: node.id,
        });
      }
      if (stream) {
        out.push({
          label: `GA4 stream ID${labelSuffix}`,
          value: stream,
          nodeId: node.id,
        });
      }
      break;
    }
    case 'google_ads_account': {
      const id = STR(meta.customerId);
      if (id) out.push({ label: `Google Ads customer ID${labelSuffix}`, value: id, nodeId: node.id });
      break;
    }
    case 'google_ads_conversion_action': {
      const id = STR(meta.conversionActionId);
      if (id) {
        out.push({
          label: `Google Ads conversion ID${labelSuffix}`,
          value: id,
          nodeId: node.id,
        });
      }
      break;
    }
    case 'meta_ads_account': {
      const id = STR(meta.adAccountId);
      if (id) out.push({ label: `Meta ad account${labelSuffix}`, value: id, nodeId: node.id });
      break;
    }
    case 'meta_pixel':
    case 'meta_capi': {
      const id = STR(meta.pixelId);
      const dataset = STR(meta.datasetId);
      if (id) {
        out.push({
          label:
            node.nodeType === 'meta_capi'
              ? `Meta CAPI pixel${labelSuffix}`
              : `Meta Pixel${labelSuffix}`,
          value: id,
          nodeId: node.id,
        });
      }
      if (dataset) {
        out.push({
          label: `Meta dataset${labelSuffix}`,
          value: dataset,
          nodeId: node.id,
        });
      }
      break;
    }
    case 'tiktok_ads_account': {
      const id = STR(meta.advertiserId);
      if (id) out.push({ label: `TikTok advertiser${labelSuffix}`, value: id, nodeId: node.id });
      break;
    }
    case 'tiktok_pixel': {
      const id = STR(meta.pixelCode);
      if (id) out.push({ label: `TikTok pixel${labelSuffix}`, value: id, nodeId: node.id });
      break;
    }
    case 'microsoft_ads_account': {
      const acc = STR(meta.accountId);
      const uet = STR(meta.uetTagId);
      if (acc) {
        out.push({ label: `Microsoft Ads account${labelSuffix}`, value: acc, nodeId: node.id });
      }
      if (uet) {
        out.push({ label: `Microsoft UET tag${labelSuffix}`, value: uet, nodeId: node.id });
      }
      break;
    }
    case 'linkedin_ads_account': {
      const acc = STR(meta.accountId);
      const insight = STR(meta.insightTagId);
      if (acc) {
        out.push({ label: `LinkedIn Ads account${labelSuffix}`, value: acc, nodeId: node.id });
      }
      if (insight) {
        out.push({ label: `LinkedIn insight tag${labelSuffix}`, value: insight, nodeId: node.id });
      }
      break;
    }
    default:
      break;
  }

  return out;
}

/**
 * Aggregate every platform ID across a client's tracking nodes.
 * Stable sort by label keeps the list readable when nodes are
 * added/removed.
 */
export function collectPlatformIds(nodes: IdNode[]): PlatformIdRow[] {
  const rows = nodes.flatMap(extractIds);
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}
