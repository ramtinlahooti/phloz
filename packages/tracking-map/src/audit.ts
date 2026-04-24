/**
 * Tracking-map audit engine. Pure function over a snapshot of
 * (nodes, edges) for a single client → list of findings.
 *
 * The rules here encode the operational knowledge an experienced
 * agency would apply when reviewing another agency's work. They are
 * deliberately conservative — a finding is only surfaced when we're
 * confident the condition is a problem, not just an unusual-but-valid
 * setup. When in doubt we emit `info`, not `warning` / `critical`.
 *
 * V1 is entirely synchronous + data-driven. V2 can fold in external
 * signals (e.g. "GA4 says your measurement ID hasn't received events
 * in 7d") once those integrations ship.
 *
 * Severity guide:
 *   - `critical` — core tracking is broken or absent. Revenue-impacting.
 *   - `warning`  — a known-bad configuration pattern, likely incomplete.
 *   - `info`     — a soft nudge (stale verification, missing nodes, etc.)
 */

import type { TrackingEdgeDto, TrackingNodeDto } from './types';

export type Severity = 'critical' | 'warning' | 'info';

export interface Finding {
  /** Stable identifier for the rule that produced this finding.
   *  Used for de-duplication + "suppress this rule" UX later. */
  ruleId: string;
  severity: Severity;
  title: string;
  description: string;
  /** Node this finding is about, when the finding is node-scoped.
   *  Map-level findings (e.g. "client has no GA4 property") omit. */
  nodeId?: string;
  /** One-sentence recommended action. Shown in the finding card. */
  suggestion?: string;
}

export interface AuditInput {
  nodes: TrackingNodeDto[];
  edges: TrackingEdgeDto[];
}

type Rule = (input: AuditInput) => Finding[];

/** How many days without verification triggers the stale-node info
 *  finding. 30d matches the common "active client" activity window. */
const STALE_VERIFICATION_DAYS = 30;

const rules: Rule[] = [
  // -------------------------------------------------------------------
  // Health-status rules — these are the most direct signals. A node
  // whose health is `broken` or `missing` was flagged manually by the
  // agency; we just surface it as an audit finding.
  // -------------------------------------------------------------------
  function brokenNodes({ nodes }) {
    return nodes
      .filter((n) => n.healthStatus === 'broken')
      .map<Finding>((n) => ({
        ruleId: 'broken-node',
        severity: 'critical',
        title: `${formatNodeType(n.nodeType)} flagged broken`,
        description: `"${n.label}" is marked as broken in the health status.`,
        nodeId: n.id,
        suggestion:
          'Fix the underlying issue (pixel firing? events arriving?) and flip the health status back to working.',
      }));
  },

  function missingNodes({ nodes }) {
    return nodes
      .filter((n) => n.healthStatus === 'missing')
      .map<Finding>((n) => ({
        ruleId: 'missing-node',
        severity: 'warning',
        title: `${formatNodeType(n.nodeType)} flagged missing`,
        description: `"${n.label}" is on the map but not yet set up.`,
        nodeId: n.id,
        suggestion:
          'Complete the configuration or archive the node if it\'s no longer needed.',
      }));
  },

  // -------------------------------------------------------------------
  // Verification hygiene — nodes that have never been verified or
  // haven't been verified in 30+ days drift out of date. This doesn't
  // mean they're broken, just that nobody's confirmed they work
  // recently.
  // -------------------------------------------------------------------
  function staleVerification({ nodes }) {
    const cutoff = Date.now() - STALE_VERIFICATION_DAYS * 24 * 60 * 60 * 1000;
    return nodes
      .filter((n) => {
        if (n.healthStatus !== 'working') return false; // other statuses already surfaced
        if (n.lastVerifiedAt === null) return false; // never-verified is a separate finding
        return n.lastVerifiedAt.getTime() < cutoff;
      })
      .map<Finding>((n) => {
        const days = Math.floor(
          (Date.now() - n.lastVerifiedAt!.getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          ruleId: 'stale-verification',
          severity: 'info',
          title: `${formatNodeType(n.nodeType)} not verified in ${days} days`,
          description: `"${n.label}" was last verified ${days} days ago.`,
          nodeId: n.id,
          suggestion:
            'Spot-check the setup and bump the "last verified" timestamp.',
        };
      });
  },

  function neverVerified({ nodes }) {
    return nodes
      .filter(
        (n) => n.healthStatus === 'working' && n.lastVerifiedAt === null,
      )
      .map<Finding>((n) => ({
        ruleId: 'never-verified',
        severity: 'info',
        title: `${formatNodeType(n.nodeType)} has never been verified`,
        description: `"${n.label}" is marked working but no one has confirmed it.`,
        nodeId: n.id,
        suggestion:
          'Take five minutes to verify the configuration and record the timestamp.',
      }));
  },

  // -------------------------------------------------------------------
  // Graph-shape rules — connections the tracking layer needs to work.
  // -------------------------------------------------------------------

  /**
   * A GTM container on the map that has no outgoing edges is almost
   * certainly mis-modelled: GTM's whole purpose is to send events
   * somewhere. Warn rather than error — the agency may have just
   * not drawn the edges yet.
   */
  function orphanGtmContainer({ nodes, edges }) {
    const outgoing = new Set(edges.map((e) => e.sourceNodeId));
    return nodes
      .filter(
        (n) =>
          (n.nodeType === 'gtm_container' ||
            n.nodeType === 'gtm_server_container') &&
          !outgoing.has(n.id),
      )
      .map<Finding>((n) => ({
        ruleId: 'orphan-gtm',
        severity: 'warning',
        title: `${formatNodeType(n.nodeType)} has no outgoing connections`,
        description: `"${n.label}" isn't sending events anywhere on the map.`,
        nodeId: n.id,
        suggestion:
          'Connect it to the destinations it sends to (GA4, pixels, server endpoints).',
      }));
  },

  /**
   * A GA4 property with an empty `measurementIds` array can't actually
   * receive web traffic. This only fires when metadata clearly says so;
   * we don't guess from other node types.
   */
  function ga4WithoutMeasurementIds({ nodes }) {
    return nodes
      .filter((n) => n.nodeType === 'ga4_property')
      .filter((n) => {
        const ids = n.metadata?.measurementIds;
        return Array.isArray(ids) && ids.length === 0;
      })
      .map<Finding>((n) => ({
        ruleId: 'ga4-no-measurement',
        severity: 'warning',
        title: 'GA4 property has no measurement IDs',
        description: `"${n.label}" is set up but has zero measurement IDs attached.`,
        nodeId: n.id,
        suggestion:
          'Add the G-XXXX measurement ID from the GA4 admin page.',
      }));
  },

  /**
   * Meta Pixel without a corresponding Meta CAPI node is the classic
   * "you're only tracking browser events" footgun. iOS 14.5+ makes
   * this a revenue-leak; flag as a warning.
   */
  function metaPixelWithoutCapi({ nodes }) {
    const hasPixel = nodes.some((n) => n.nodeType === 'meta_pixel');
    const hasCapi = nodes.some((n) => n.nodeType === 'meta_capi');
    if (!hasPixel || hasCapi) return [];
    // Attach the finding to the first pixel so clicking the finding
    // card has somewhere to land.
    const anchor = nodes.find((n) => n.nodeType === 'meta_pixel');
    return [
      {
        ruleId: 'meta-pixel-no-capi',
        severity: 'warning',
        title: 'Meta Pixel without Conversions API',
        description:
          'Browser-side Pixel events alone miss ~15–30% of conversions on iOS. No Meta CAPI node is on the map.',
        nodeId: anchor?.id,
        suggestion:
          'Add a Meta CAPI node and connect it to the pixel + server endpoint.',
      },
    ];
  },

  // -------------------------------------------------------------------
  // Coverage rules — a client whose tracking is missing an entire
  // category.
  // -------------------------------------------------------------------

  function noGa4AtAll({ nodes }) {
    if (nodes.length === 0) return []; // empty-map rule handles this
    const hasGa4 = nodes.some(
      (n) =>
        n.nodeType === 'ga4_property' || n.nodeType === 'ga4_data_stream',
    );
    if (hasGa4) return [];
    return [
      {
        ruleId: 'no-ga4',
        severity: 'critical',
        title: 'No GA4 property or stream on the map',
        description:
          'This client has tracking nodes but no GA4 property. GA4 is the baseline analytics source — something is either missing or mis-modelled.',
        suggestion: 'Add a GA4 property node and link it to the website.',
      },
    ];
  },

  function emptyMap({ nodes }) {
    if (nodes.length > 0) return [];
    return [
      {
        ruleId: 'empty-map',
        severity: 'info',
        title: 'No tracking setup on the map yet',
        description:
          'This client has no tracking nodes. Map their setup so the audit can flag gaps.',
        suggestion:
          'Open the Tracking map tab and drop in the first node (usually the website).',
      },
    ];
  },
];

/**
 * Run the full audit against a map snapshot. Output is sorted
 * deterministically: critical → warning → info, then by rule id for
 * stable grouping in the UI.
 */
export function auditMap(input: AuditInput): Finding[] {
  const out: Finding[] = [];
  for (const rule of rules) {
    out.push(...rule(input));
  }
  return out.sort((a, b) => {
    const rank =
      severityRank(a.severity) - severityRank(b.severity);
    if (rank !== 0) return rank;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

function severityRank(s: Severity): number {
  if (s === 'critical') return 0;
  if (s === 'warning') return 1;
  return 2;
}

/** Convert `'gtm_container'` → `'GTM container'`. Shared between rule
 *  messages so finding titles stay consistent. */
function formatNodeType(nodeType: string): string {
  return nodeType
    .split('_')
    .map((w, i) => (i === 0 ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/^Gtm/, 'GTM')
    .replace(/^Ga4/, 'GA4');
}

// Export the rule list for tests + future "suppressed rules" UX.
export const AUDIT_RULE_IDS = [
  'broken-node',
  'missing-node',
  'stale-verification',
  'never-verified',
  'orphan-gtm',
  'ga4-no-measurement',
  'meta-pixel-no-capi',
  'no-ga4',
  'empty-map',
] as const;
export type AuditRuleId = (typeof AUDIT_RULE_IDS)[number];
