import type {
  Department,
  TaskPriority,
  TaskVisibility,
} from '@phloz/config';

/**
 * Built-in task templates.
 *
 * V1 ships a small curated set of agency workflows. Each template
 * produces N tasks scoped to a single client. Apply via
 * `applyTaskTemplateAction(workspaceId, clientId, templateId)`.
 *
 * Keeping these in code (not DB) for V1:
 *   - zero admin UI needed
 *   - changes ship via a PR, not a DB migration
 *   - per-workspace customisation is a V2 feature (dupe-to-workspace)
 *
 * Add a template: append to TASK_TEMPLATES, update the `id` to be
 * kebab-case + unique, and add a descriptive summary so the UI picker
 * reads well.
 */
export type TaskTemplateItem = {
  title: string;
  description?: string;
  priority?: TaskPriority;
  department?: Department;
  visibility?: TaskVisibility;
  /** Days from today when applied (0 = no due date). */
  dueInDays?: number;
};

export type TaskTemplate = {
  id: string;
  name: string;
  summary: string;
  /** Optional category for the picker grouping. */
  category: 'ppc' | 'seo' | 'social' | 'reporting' | 'onboarding' | 'general';
  items: TaskTemplateItem[];
};

export const TASK_TEMPLATES: readonly TaskTemplate[] = [
  {
    id: 'new-campaign-launch',
    name: 'New campaign launch',
    summary:
      'Media plan, creative brief, tracking sign-off, QA, and launch checklist.',
    category: 'ppc',
    items: [
      {
        title: 'Media plan + budget split',
        description:
          'Propose channel-by-channel budget split, audience strategy, and flight dates.',
        priority: 'high',
        department: 'ppc',
        dueInDays: 3,
      },
      {
        title: 'Creative brief',
        description:
          'Write the creative brief: objective, audience, message pillars, mandatory claims.',
        priority: 'high',
        department: 'ppc',
        dueInDays: 5,
      },
      {
        title: 'Tracking + conversion setup',
        description:
          'Confirm every conversion action fires, enhanced conversions enabled, value + currency correct.',
        priority: 'urgent',
        department: 'ppc',
        dueInDays: 7,
      },
      {
        title: 'Client approval on creative',
        description: 'Send creative to client via portal, confirm sign-off.',
        priority: 'high',
        department: 'ppc',
        visibility: 'client_visible',
        dueInDays: 9,
      },
      {
        title: 'Pre-launch QA (landing + checkout)',
        description:
          'Click every CTA, confirm thank-you pages fire, verify UTMs propagate.',
        priority: 'urgent',
        department: 'ppc',
        dueInDays: 10,
      },
      {
        title: 'Launch + watch first 48h',
        description:
          'Go live, monitor pacing + CPA + tracking health, fix anomalies fast.',
        priority: 'high',
        department: 'ppc',
        dueInDays: 12,
      },
    ],
  },
  {
    id: 'monthly-report',
    name: 'Monthly client report',
    summary:
      'Gather data, write commentary, prep slides, review internally, share with client.',
    category: 'reporting',
    items: [
      {
        title: 'Pull channel data (GA4, ad platforms)',
        description:
          'Export the numbers against last month + target. Flag outliers in a comment.',
        priority: 'medium',
        department: 'other',
        dueInDays: 2,
      },
      {
        title: 'Write executive summary + recommendations',
        priority: 'medium',
        department: 'other',
        dueInDays: 4,
      },
      {
        title: 'Internal review',
        description: 'Team reviews draft, leaves comments.',
        priority: 'medium',
        department: 'other',
        dueInDays: 5,
      },
      {
        title: 'Share report with client',
        description: 'Upload via portal + email a summary.',
        priority: 'high',
        department: 'other',
        visibility: 'client_visible',
        dueInDays: 6,
      },
    ],
  },
  {
    id: 'tracking-audit',
    name: 'Tracking infrastructure audit',
    summary:
      'Verify every pixel, conversion, and audience is firing. Flag what\'s broken.',
    category: 'onboarding',
    items: [
      {
        title: 'Inventory existing tracking',
        description:
          'Add every GA4 property, GTM container, pixel, conversion to the Tracking map.',
        priority: 'high',
        department: 'other',
        dueInDays: 2,
      },
      {
        title: 'Verify pixel firing',
        description:
          'Click through each conversion path; confirm the right event fires with the right parameters.',
        priority: 'high',
        department: 'other',
        dueInDays: 4,
      },
      {
        title: 'Document ownership',
        description:
          'For every tracking node, record who owns access + last-verified date.',
        priority: 'medium',
        department: 'other',
        dueInDays: 5,
      },
      {
        title: 'Write audit summary for client',
        priority: 'medium',
        department: 'other',
        visibility: 'client_visible',
        dueInDays: 6,
      },
    ],
  },
  {
    id: 'seo-onboarding',
    name: 'SEO onboarding',
    summary:
      'Technical audit, content inventory, keyword map, priority fix list.',
    category: 'seo',
    items: [
      {
        title: 'Technical SEO audit',
        description:
          'Crawl the site, flag indexation / speed / schema / core web vitals issues.',
        priority: 'high',
        department: 'seo',
        dueInDays: 5,
      },
      {
        title: 'Content inventory + keyword map',
        description:
          'Catalogue existing pages, map to priority keywords, identify gaps.',
        priority: 'medium',
        department: 'seo',
        dueInDays: 10,
      },
      {
        title: 'GSC + GA4 access confirmed',
        description: 'Request access from client; add to tracking map.',
        priority: 'urgent',
        department: 'seo',
        dueInDays: 3,
      },
      {
        title: 'Priority fix list shared with client',
        priority: 'high',
        department: 'seo',
        visibility: 'client_visible',
        dueInDays: 14,
      },
    ],
  },
  {
    id: 'social-content-month',
    name: 'Social content — one month',
    summary:
      '4-week content calendar from brief to publish, with approval gates.',
    category: 'social',
    items: [
      {
        title: 'Monthly content brief',
        description:
          'Theme, pillars, post types, channel mix for the coming 4 weeks.',
        priority: 'high',
        department: 'social',
        dueInDays: 2,
      },
      {
        title: 'Draft posts + creative',
        priority: 'high',
        department: 'social',
        dueInDays: 5,
      },
      {
        title: 'Internal review',
        priority: 'medium',
        department: 'social',
        dueInDays: 6,
      },
      {
        title: 'Client approval via portal',
        priority: 'high',
        department: 'social',
        visibility: 'client_visible',
        dueInDays: 8,
      },
      {
        title: 'Schedule + publish',
        priority: 'medium',
        department: 'social',
        dueInDays: 9,
      },
    ],
  },
];

export function findTaskTemplate(id: string): TaskTemplate | null {
  return TASK_TEMPLATES.find((t) => t.id === id) ?? null;
}
