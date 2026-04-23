import { z } from 'zod';

import { BarChart3, LineChart, type NodeTypeDescriptor } from './registry';

export const ga4PropertySchema = z.object({
  propertyId: z.string().min(1, 'Required').describe('GA4 property ID (e.g. "123456789")'),
  measurementIds: z
    .array(z.string().regex(/^G-[A-Z0-9]+$/, 'Must look like G-XXXXXXXXXX'))
    .default([])
    .describe('Measurement IDs on this property'),
  owner: z.string().optional().describe('Who owns access (email or team)'),
  notes: z.string().max(500).optional(),
});
export type Ga4PropertyMetadata = z.infer<typeof ga4PropertySchema>;

export const ga4PropertyDescriptor: NodeTypeDescriptor<typeof ga4PropertySchema> = {
  type: 'ga4_property',
  label: 'GA4 property',
  category: 'analytics',
  icon: BarChart3,
  accent: 'text-amber-400',
  summary: 'Google Analytics 4 property with measurement IDs + owner',
  schema: ga4PropertySchema,
  defaults: () => ({
    propertyId: '',
    measurementIds: [],
  }),
};

export const ga4DataStreamSchema = z.object({
  streamId: z.string().min(1, 'Required'),
  measurementId: z.string().regex(/^G-[A-Z0-9]+$/, 'Must look like G-XXXXXXXXXX'),
  domain: z.string().url().or(z.literal('')).optional(),
  type: z.enum(['web', 'ios', 'android']).default('web'),
});
export type Ga4DataStreamMetadata = z.infer<typeof ga4DataStreamSchema>;

export const ga4DataStreamDescriptor: NodeTypeDescriptor<typeof ga4DataStreamSchema> = {
  type: 'ga4_data_stream',
  label: 'GA4 data stream',
  category: 'analytics',
  icon: LineChart,
  accent: 'text-amber-300',
  summary: 'A single web / iOS / Android stream inside a GA4 property',
  schema: ga4DataStreamSchema,
  defaults: () => ({
    streamId: '',
    measurementId: '',
    type: 'web' as const,
  }),
};
