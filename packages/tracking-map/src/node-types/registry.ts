import type { NodeType } from '@phloz/config';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  Code2,
  CreditCard,
  Database,
  Share2,
  Globe,
  LineChart,
  Link as LinkIcon,
  Mail,
  Music2,
  PanelTop,
  Pointer,
  Server,
  ShoppingBag,
  Target,
  Tag,
  Workflow,
  Zap,
} from 'lucide-react';
import { z, type ZodTypeAny } from 'zod';

/**
 * Every tracking node type has one of these descriptors. Used by the
 * canvas (icon + colour), the add-node menu (category + label), and
 * the right drawer (Zod metadata schema).
 */
export interface NodeTypeDescriptor<TSchema extends ZodTypeAny = ZodTypeAny> {
  type: NodeType;
  label: string;
  /** Category the add-node menu groups this under. */
  category:
    | 'analytics'
    | 'tag-management'
    | 'paid-media'
    | 'server'
    | 'commerce'
    | 'email'
    | 'crm'
    | 'other';
  icon: LucideIcon;
  /** Tailwind colour class applied to the node chip border + icon. */
  accent: string;
  /** Short one-liner shown in the add-node menu. */
  summary: string;
  /** Zod schema the metadata form validates against. */
  schema: TSchema;
  /** Default metadata for newly-created nodes of this type. */
  defaults: () => Record<string, unknown>;
}

/** Plain descriptor with a `z.any()` schema — used by the fallback. */
export type AnyNodeTypeDescriptor = NodeTypeDescriptor<ZodTypeAny>;

/** Runtime registry populated by the per-type files. */
const registry = new Map<NodeType, AnyNodeTypeDescriptor>();

export function registerNodeType(descriptor: AnyNodeTypeDescriptor) {
  registry.set(descriptor.type, descriptor);
}

export function getNodeTypeDescriptor(
  type: NodeType,
): AnyNodeTypeDescriptor {
  const d = registry.get(type);
  if (d) return d;
  // Fall back to the `custom` descriptor — it accepts anything and
  // renders as a generic node.
  return (
    registry.get('custom') ??
    fallbackDescriptor(type)
  );
}

export function listNodeTypeDescriptors(): AnyNodeTypeDescriptor[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

/** Used when `custom` isn't registered yet (tests / early init). */
function fallbackDescriptor(type: NodeType): AnyNodeTypeDescriptor {
  return {
    type,
    label: type,
    category: 'other',
    icon: Boxes,
    accent: 'text-muted-foreground',
    summary: 'Unregistered node type',
    schema: z.record(z.unknown()).default({}),
    defaults: () => ({}),
  };
}

// Icon re-exports so per-type files stay terse.
export {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  Code2,
  CreditCard,
  Database,
  Share2,
  Globe,
  LineChart,
  LinkIcon,
  Mail,
  Music2,
  PanelTop,
  Pointer,
  Server,
  ShoppingBag,
  Target,
  Tag,
  Workflow,
  Zap,
};
