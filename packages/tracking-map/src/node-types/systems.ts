import { z } from 'zod';

import {
  Boxes,
  CreditCard,
  Database,
  Mail,
  Server,
  ShoppingBag,
  type NodeTypeDescriptor,
} from './registry';

export const crmSystemSchema = z.object({
  name: z.string().min(1),
  vendor: z
    .enum(['hubspot', 'salesforce', 'pipedrive', 'zoho', 'other'])
    .default('other'),
  instanceUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});
export const crmSystemDescriptor: NodeTypeDescriptor<typeof crmSystemSchema> = {
  type: 'crm_system',
  label: 'CRM system',
  category: 'crm',
  icon: Database,
  accent: 'text-orange-400',
  summary: 'Client\'s CRM (HubSpot, Salesforce, etc.)',
  schema: crmSystemSchema,
  defaults: () => ({ name: '', vendor: 'other' as const }),
};

export const emailPlatformSchema = z.object({
  name: z.string().min(1),
  vendor: z
    .enum(['klaviyo', 'mailchimp', 'activecampaign', 'customerio', 'postmark', 'other'])
    .default('other'),
  listIds: z.array(z.string()).default([]),
  notes: z.string().max(500).optional(),
});
export const emailPlatformDescriptor: NodeTypeDescriptor<typeof emailPlatformSchema> = {
  type: 'email_platform',
  label: 'Email platform',
  category: 'email',
  icon: Mail,
  accent: 'text-rose-400',
  summary: 'Email marketing platform (Klaviyo, etc.)',
  schema: emailPlatformSchema,
  defaults: () => ({ name: '', vendor: 'other' as const, listIds: [] }),
};

export const ecommercePlatformSchema = z.object({
  name: z.string().min(1),
  vendor: z
    .enum(['shopify', 'bigcommerce', 'woocommerce', 'magento', 'custom'])
    .default('shopify'),
  storeUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
});
export const ecommercePlatformDescriptor: NodeTypeDescriptor<typeof ecommercePlatformSchema> = {
  type: 'ecommerce_platform',
  label: 'E-commerce platform',
  category: 'commerce',
  icon: ShoppingBag,
  accent: 'text-violet-400',
  summary: 'Shopify / BigCommerce / etc.',
  schema: ecommercePlatformSchema,
  defaults: () => ({ name: '', vendor: 'shopify' as const }),
};

export const serverEndpointSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT']).default('POST'),
  authType: z.enum(['none', 'bearer', 'basic', 'custom']).default('bearer'),
  notes: z.string().max(500).optional(),
});
export const serverEndpointDescriptor: NodeTypeDescriptor<typeof serverEndpointSchema> = {
  type: 'server_endpoint',
  label: 'Server endpoint',
  category: 'server',
  icon: Server,
  accent: 'text-slate-300',
  summary: 'Custom server endpoint that receives events',
  schema: serverEndpointSchema,
  defaults: () => ({
    url: '',
    method: 'POST' as const,
    authType: 'bearer' as const,
  }),
};

export const conversionApiEndpointSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  platform: z
    .enum(['meta_capi', 'google_offline_conversion', 'tiktok_events_api', 'custom'])
    .default('custom'),
  notes: z.string().max(500).optional(),
});
export const conversionApiEndpointDescriptor: NodeTypeDescriptor<typeof conversionApiEndpointSchema> = {
  type: 'conversion_api_endpoint',
  label: 'Conversion API endpoint',
  category: 'server',
  icon: CreditCard,
  accent: 'text-lime-400',
  summary: 'Custom conversion-API endpoint',
  schema: conversionApiEndpointSchema,
  defaults: () => ({
    name: '',
    url: '',
    platform: 'custom' as const,
  }),
};

// `custom` — always-last fallback
export const customSchema = z
  .object({
    summary: z.string().max(280).optional(),
    url: z.string().url().optional(),
    externalId: z.string().optional(),
    notes: z.string().max(500).optional(),
  })
  .partial()
  .default({});
export const customDescriptor: NodeTypeDescriptor<typeof customSchema> = {
  type: 'custom',
  label: 'Custom',
  category: 'other',
  icon: Boxes,
  accent: 'text-muted-foreground',
  summary: 'Anything else — free-form metadata',
  schema: customSchema,
  defaults: () => ({}),
};
