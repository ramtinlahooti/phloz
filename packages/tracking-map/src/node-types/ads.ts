import { z } from 'zod';

import {
  Building2,
  Share2,
  Music2,
  Target,
  Zap,
  type NodeTypeDescriptor,
} from './registry';

// --- Google Ads --------------------------------------------------------
export const googleAdsAccountSchema = z.object({
  customerId: z
    .string()
    .regex(/^\d{3}-?\d{3}-?\d{4}$/, 'Must look like 123-456-7890'),
  managerId: z.string().optional(),
  currency: z.string().length(3).optional(),
  enhancedConversionsEnabled: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});
export type GoogleAdsAccountMetadata = z.infer<typeof googleAdsAccountSchema>;

export const googleAdsAccountDescriptor: NodeTypeDescriptor<typeof googleAdsAccountSchema> = {
  type: 'google_ads_account',
  label: 'Google Ads account',
  category: 'paid-media',
  icon: Target,
  accent: 'text-sky-400',
  summary: 'Google Ads advertiser account',
  schema: googleAdsAccountSchema,
  defaults: () => ({
    customerId: '',
    enhancedConversionsEnabled: false,
  }),
};

export const googleAdsConversionSchema = z.object({
  conversionActionId: z.string().min(1),
  name: z.string().min(1),
  category: z.enum([
    'purchase',
    'lead',
    'signup',
    'page_view',
    'download',
    'other',
  ]).default('other'),
  valueType: z.enum(['transaction', 'same', 'none']).default('same'),
  currency: z.string().length(3).default('USD'),
  notes: z.string().max(500).optional(),
});
export type GoogleAdsConversionMetadata = z.infer<typeof googleAdsConversionSchema>;

export const googleAdsConversionDescriptor: NodeTypeDescriptor<typeof googleAdsConversionSchema> = {
  type: 'google_ads_conversion_action',
  label: 'Google Ads conversion',
  category: 'paid-media',
  icon: Zap,
  accent: 'text-sky-300',
  summary: 'A single Google Ads conversion action',
  schema: googleAdsConversionSchema,
  defaults: () => ({
    conversionActionId: '',
    name: '',
    category: 'other' as const,
    valueType: 'same' as const,
    currency: 'USD',
  }),
};

// --- Meta Ads ----------------------------------------------------------
export const metaAdsAccountSchema = z.object({
  adAccountId: z.string().regex(/^act_\d+$/, 'Must look like act_1234567890'),
  businessId: z.string().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(500).optional(),
});
export const metaAdsAccountDescriptor: NodeTypeDescriptor<typeof metaAdsAccountSchema> = {
  type: 'meta_ads_account',
  label: 'Meta Ads account',
  category: 'paid-media',
  icon: Building2,
  accent: 'text-indigo-400',
  summary: 'Facebook / Instagram advertiser account',
  schema: metaAdsAccountSchema,
  defaults: () => ({ adAccountId: '' }),
};

export const metaPixelSchema = z.object({
  pixelId: z.string().regex(/^\d{10,20}$/, 'Must be a 10-20 digit pixel ID'),
  datasetId: z.string().optional(),
  advancedMatchingEnabled: z.boolean().default(false),
  capiEnabled: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});
export const metaPixelDescriptor: NodeTypeDescriptor<typeof metaPixelSchema> = {
  type: 'meta_pixel',
  label: 'Meta pixel',
  category: 'paid-media',
  icon: Share2,
  accent: 'text-indigo-300',
  summary: 'Facebook / Instagram tracking pixel',
  schema: metaPixelSchema,
  defaults: () => ({
    pixelId: '',
    advancedMatchingEnabled: false,
    capiEnabled: false,
  }),
};

export const metaCapiSchema = z.object({
  pixelId: z.string().regex(/^\d{10,20}$/),
  datasetId: z.string().optional(),
  endpoint: z.enum(['meta_gateway', 'custom_server']).default('meta_gateway'),
  testEventCode: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export const metaCapiDescriptor: NodeTypeDescriptor<typeof metaCapiSchema> = {
  type: 'meta_capi',
  label: 'Meta Conversions API',
  category: 'server',
  icon: Zap,
  accent: 'text-indigo-500',
  summary: 'Server-side Conversions API endpoint',
  schema: metaCapiSchema,
  defaults: () => ({
    pixelId: '',
    endpoint: 'meta_gateway' as const,
  }),
};

// --- TikTok Ads --------------------------------------------------------
export const tiktokAdsAccountSchema = z.object({
  advertiserId: z.string().min(1),
  businessCenter: z.string().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(500).optional(),
});
export const tiktokAdsAccountDescriptor: NodeTypeDescriptor<typeof tiktokAdsAccountSchema> = {
  type: 'tiktok_ads_account',
  label: 'TikTok Ads account',
  category: 'paid-media',
  icon: Music2,
  accent: 'text-pink-400',
  summary: 'TikTok for Business advertiser account',
  schema: tiktokAdsAccountSchema,
  defaults: () => ({ advertiserId: '' }),
};

export const tiktokPixelSchema = z.object({
  pixelCode: z.string().min(1, 'Required'),
  eventsApiEnabled: z.boolean().default(false),
  advancedMatchingEnabled: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});
export const tiktokPixelDescriptor: NodeTypeDescriptor<typeof tiktokPixelSchema> = {
  type: 'tiktok_pixel',
  label: 'TikTok pixel',
  category: 'paid-media',
  icon: Music2,
  accent: 'text-pink-300',
  summary: 'TikTok tracking pixel / events API target',
  schema: tiktokPixelSchema,
  defaults: () => ({
    pixelCode: '',
    eventsApiEnabled: false,
    advancedMatchingEnabled: false,
  }),
};

// --- Microsoft + LinkedIn (compact) -----------------------------------
export const microsoftAdsAccountSchema = z.object({
  accountId: z.string().min(1),
  uetTagId: z.string().optional(),
  currency: z.string().length(3).optional(),
});
export const microsoftAdsAccountDescriptor: NodeTypeDescriptor<typeof microsoftAdsAccountSchema> = {
  type: 'microsoft_ads_account',
  label: 'Microsoft Ads account',
  category: 'paid-media',
  icon: Target,
  accent: 'text-cyan-400',
  summary: 'Microsoft (Bing) Ads account + UET tag',
  schema: microsoftAdsAccountSchema,
  defaults: () => ({ accountId: '' }),
};

export const linkedinAdsAccountSchema = z.object({
  accountId: z.string().min(1),
  insightTagId: z.string().optional(),
  conversionApiEnabled: z.boolean().default(false),
});
export const linkedinAdsAccountDescriptor: NodeTypeDescriptor<typeof linkedinAdsAccountSchema> = {
  type: 'linkedin_ads_account',
  label: 'LinkedIn Ads account',
  category: 'paid-media',
  icon: Target,
  accent: 'text-blue-500',
  summary: 'LinkedIn advertiser account + insight tag',
  schema: linkedinAdsAccountSchema,
  defaults: () => ({ accountId: '', conversionApiEnabled: false }),
};
