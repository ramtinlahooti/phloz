import { z } from 'zod';

import { Server, Tag, type NodeTypeDescriptor } from './registry';

export const gtmContainerSchema = z.object({
  containerId: z
    .string()
    .regex(/^GTM-[A-Z0-9]+$/, 'Must look like GTM-XXXXXXX'),
  accountId: z.string().optional(),
  workspaceName: z.string().optional(),
  environment: z.enum(['live', 'staging']).default('live'),
  notes: z.string().max(500).optional(),
});
export type GtmContainerMetadata = z.infer<typeof gtmContainerSchema>;

export const gtmContainerDescriptor: NodeTypeDescriptor<typeof gtmContainerSchema> = {
  type: 'gtm_container',
  label: 'GTM container',
  category: 'tag-management',
  icon: Tag,
  accent: 'text-blue-400',
  summary: 'Google Tag Manager container (GTM-XXXXXXX)',
  schema: gtmContainerSchema,
  defaults: () => ({ containerId: '', environment: 'live' as const }),
};

export const gtmServerContainerSchema = z.object({
  containerId: z.string().regex(/^GTM-[A-Z0-9]+$/, 'Must look like GTM-XXXXXXX'),
  serverUrl: z.string().url(),
  environment: z.enum(['live', 'staging']).default('live'),
  notes: z.string().max(500).optional(),
});
export type GtmServerContainerMetadata = z.infer<typeof gtmServerContainerSchema>;

export const gtmServerContainerDescriptor: NodeTypeDescriptor<typeof gtmServerContainerSchema> = {
  type: 'gtm_server_container',
  label: 'GTM server container',
  category: 'server',
  icon: Server,
  accent: 'text-blue-300',
  summary: 'Server-side GTM container with a custom URL',
  schema: gtmServerContainerSchema,
  defaults: () => ({
    containerId: '',
    serverUrl: '',
    environment: 'live' as const,
  }),
};
