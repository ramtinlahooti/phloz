'use client';

import { CheckCircle2, AlertTriangle, HelpCircle, XCircle, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { HealthStatus } from '@phloz/config';
import {
  Badge,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  toast,
} from '@phloz/ui';

import { formatLastVerified, HEALTH_STATUS_CONFIG } from '../health';
import { getNodeTypeDescriptor } from '../node-types/registry';

import type { PhlozNodeData } from './custom-node';

type DrawerState =
  | { open: true; node: PhlozNodeData }
  | { open: false };

type Props = {
  state: DrawerState;
  onClose: () => void;
  onSave: (update: {
    id: string;
    label: string;
    metadata: Record<string, unknown>;
    healthStatus: HealthStatus;
    markVerified: boolean;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const HEALTH_ICONS: Record<HealthStatus, typeof CheckCircle2> = {
  working: CheckCircle2,
  broken: XCircle,
  missing: AlertTriangle,
  unverified: HelpCircle,
};

/**
 * Right-side drawer for editing a single node. Type-aware: reads the
 * node-type descriptor's Zod schema to render the metadata form.
 *
 * Metadata fields are rendered generically from the schema's
 * `_def.shape` — we support string, number, boolean, enum, and
 * string-array inputs. That covers every registered descriptor today;
 * richer field types can plug in as needed.
 */
export function NodeDrawer({ state, onClose, onSave, onDelete }: Props) {
  const node = state.open ? state.node : null;
  const descriptor = node ? getNodeTypeDescriptor(node.nodeType) : null;

  const [label, setLabel] = useState('');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('unverified');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setLabel(node.label);
      setMetadata(node.metadata ?? {});
      setHealthStatus(node.healthStatus);
    }
  }, [node]);

  const fields = useMemo(() => (descriptor ? extractFields(descriptor.schema) : []), [descriptor]);

  if (!node || !descriptor) return null;

  const Icon = descriptor.icon;
  const health = HEALTH_STATUS_CONFIG[healthStatus];

  async function handleSave(markVerified: boolean) {
    if (!node) return;
    const parsed = descriptor!.schema.safeParse(metadata);
    if (!parsed.success) {
      toast.error(
        parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('\n'),
      );
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: node.dbId,
        label: label.trim() || descriptor!.label,
        metadata: parsed.data as Record<string, unknown>,
        healthStatus,
        markVerified,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!node) return;
    if (!confirm('Delete this node and every edge touching it?')) return;
    setSaving(true);
    try {
      await onDelete(node.dbId);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={state.open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Icon className={`size-4 ${descriptor.accent}`} aria-hidden />
            <SheetTitle>{descriptor.label}</SheetTitle>
          </div>
          <SheetDescription>{descriptor.summary}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="node-label">Label</Label>
            <Input
              id="node-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={descriptor.label}
            />
          </div>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Health
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(
                ['working', 'broken', 'missing', 'unverified'] as HealthStatus[]
              ).map((s) => {
                const H = HEALTH_ICONS[s];
                const cfg = HEALTH_STATUS_CONFIG[s];
                const active = healthStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setHealthStatus(s)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/60'
                    }`}
                  >
                    <H className="size-3.5" style={{ color: cfg.color }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Last verified: {formatLastVerified(node.lastVerifiedAt)}.
            </p>
          </section>

          {fields.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Metadata
              </h3>
              {fields.map((f) => (
                <FieldInput
                  key={f.name}
                  field={f}
                  value={metadata[f.name]}
                  onChange={(v) => setMetadata({ ...metadata, [f.name]: v })}
                />
              ))}
            </section>
          )}
        </div>

        <SheetFooter className="mt-8 gap-2 sm:gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={saving}
            className="sm:mr-auto"
          >
            <Trash2 className="size-4" /> Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            Save
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>
            Save + mark verified
          </Button>
        </SheetFooter>

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge
            variant="outline"
            style={{ borderColor: health.color, color: health.color }}
          >
            {health.label}
          </Badge>
          <span>{health.description}</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- Generic Zod-driven field rendering ---------------------------------

type FieldDef = {
  name: string;
  kind: 'string' | 'number' | 'boolean' | 'enum' | 'string-array' | 'unknown';
  options?: readonly string[];
  placeholder?: string;
  description?: string;
};

function extractFields(
  schema: import('zod').ZodTypeAny,
  inheritedDescription?: string,
): FieldDef[] {
  const shape = unwrap(schema);
  if (!shape || typeof shape !== 'object') return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = Object.entries((shape as any)._def?.shape?.() ?? {});
  void inheritedDescription;

  return entries.map<FieldDef>(([name, s]) => {
    const underlying = unwrap(s as import('zod').ZodTypeAny);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const def: any = underlying._def;
    const description = (s as import('zod').ZodTypeAny).description;

    if (def.typeName === 'ZodEnum') {
      return {
        name,
        kind: 'enum',
        options: def.values as readonly string[],
        description,
      };
    }
    if (def.typeName === 'ZodBoolean') {
      return { name, kind: 'boolean', description };
    }
    if (def.typeName === 'ZodNumber') {
      return { name, kind: 'number', description };
    }
    if (def.typeName === 'ZodString') {
      return { name, kind: 'string', placeholder: def.description, description };
    }
    if (def.typeName === 'ZodArray' && unwrap(def.type)._def?.typeName === 'ZodString') {
      return { name, kind: 'string-array', description };
    }
    return { name, kind: 'unknown', description };
  });
}

function unwrap(schema: import('zod').ZodTypeAny): import('zod').ZodTypeAny {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any = schema;
  while (s?._def) {
    const t = s._def.typeName;
    if (
      t === 'ZodOptional' ||
      t === 'ZodNullable' ||
      t === 'ZodDefault' ||
      t === 'ZodEffects'
    ) {
      s = s._def.innerType ?? s._def.schema;
      continue;
    }
    break;
  }
  return s as import('zod').ZodTypeAny;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const humanLabel = toTitleCase(field.name);

  if (field.kind === 'boolean') {
    return (
      <label className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
        <span className="text-sm">{humanLabel}</span>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    );
  }

  if (field.kind === 'enum' && field.options) {
    return (
      <div className="space-y-1">
        <Label>{humanLabel}</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.kind === 'number') {
    return (
      <div className="space-y-1">
        <Label>{humanLabel}</Label>
        <Input
          type="number"
          value={(value as number | undefined) ?? ''}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : Number(e.target.value))
          }
        />
      </div>
    );
  }

  if (field.kind === 'string-array') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-1">
        <Label>{humanLabel}</Label>
        <Input
          placeholder="Comma-separated"
          value={arr.join(', ')}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      </div>
    );
  }

  // string / unknown — render as single-line input
  return (
    <div className="space-y-1">
      <Label>{humanLabel}</Label>
      <Input
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  );
}

function toTitleCase(s: string): string {
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
