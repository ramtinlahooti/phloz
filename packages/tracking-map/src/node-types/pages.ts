import { z } from 'zod';

import { Globe, PanelTop, type NodeTypeDescriptor } from './registry';

export const websiteSchema = z.object({
  url: z.string().url(),
  platform: z
    .enum([
      'shopify',
      'wordpress',
      'webflow',
      'nextjs',
      'custom',
      'other',
    ])
    .default('other'),
  notes: z.string().max(500).optional(),
});
export const websiteDescriptor: NodeTypeDescriptor<typeof websiteSchema> = {
  type: 'website',
  label: 'Website',
  category: 'other',
  icon: Globe,
  accent: 'text-emerald-400',
  summary: 'The client\'s top-level domain',
  schema: websiteSchema,
  defaults: () => ({ url: '', platform: 'other' as const }),
};

export const landingPageSchema = z.object({
  url: z.string().url(),
  purpose: z.enum(['campaign', 'evergreen', 'thank_you']).default('campaign'),
  notes: z.string().max(500).optional(),
});
export const landingPageDescriptor: NodeTypeDescriptor<typeof landingPageSchema> = {
  type: 'landing_page',
  label: 'Landing page',
  category: 'other',
  icon: PanelTop,
  accent: 'text-emerald-300',
  summary: 'A single campaign or evergreen landing URL',
  schema: landingPageSchema,
  defaults: () => ({ url: '', purpose: 'campaign' as const }),
};
