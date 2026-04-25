'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@phloz/ui';

import { websiteFormFieldSchema } from '@/lib/url-input';

import { updateClientAction } from './update-actions';

const schema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  businessName: z.string().trim().max(200).optional(),
  businessEmail: z
    .string()
    .email('Enter a valid email')
    .max(200)
    .optional()
    .or(z.literal('')),
  businessPhone: z.string().max(60).optional(),
  websiteUrl: websiteFormFieldSchema,
  industry: z.string().trim().max(120).optional(),
});
type Values = z.infer<typeof schema>;

export type ClientOverviewData = {
  name: string;
  businessName: string | null;
  businessEmail: string | null;
  businessPhone: string | null;
  websiteUrl: string | null;
  industry: string | null;
};

/**
 * Read-only summary of the client's "business card" fields with an
 * Edit button that flips the same block into a form. Saves all fields
 * in a single `updateClientAction` call.
 */
export function ClientOverviewForm({
  workspaceId,
  clientId,
  initial,
}: {
  workspaceId: string;
  clientId: string;
  initial: ClientOverviewData;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial.name,
      businessName: initial.businessName ?? '',
      businessEmail: initial.businessEmail ?? '',
      businessPhone: initial.businessPhone ?? '',
      websiteUrl: initial.websiteUrl ?? '',
      industry: initial.industry ?? '',
    },
  });

  async function onSubmit(values: Values) {
    setSaving(true);
    try {
      const res = await updateClientAction({
        workspaceId,
        clientId,
        name: values.name.trim(),
        businessName: values.businessName?.trim() || null,
        businessEmail: values.businessEmail?.trim() || null,
        businessPhone: values.businessPhone?.trim() || null,
        // Pass the raw user input — the action calls
        // `normaliseWebsiteInput` so "acme.com" → "https://acme.com"
        // before it lands in the DB. Empty input → null clears the
        // field on save.
        websiteUrl: values.websiteUrl?.trim() || null,
        industry: values.industry?.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Saved');
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    form.reset({
      name: initial.name,
      businessName: initial.businessName ?? '',
      businessEmail: initial.businessEmail ?? '',
      businessPhone: initial.businessPhone ?? '',
      websiteUrl: initial.websiteUrl ?? '',
      industry: initial.industry ?? '',
    });
    setEditing(false);
  }

  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Details
          </CardTitle>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-3.5" /> Edit
          </Button>
        </CardHeader>
        <CardContent className="text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={initial.name} />
            <Field label="Business name" value={initial.businessName} />
            <Field
              label="Email"
              value={initial.businessEmail}
              link={initial.businessEmail ? `mailto:${initial.businessEmail}` : null}
            />
            <Field label="Phone" value={initial.businessPhone} />
            <Field
              label="Website"
              value={initial.websiteUrl}
              link={initial.websiteUrl}
            />
            <Field label="Industry" value={initial.industry} />
          </dl>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Edit details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4 sm:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Business name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="websiteUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl>
                    <Input placeholder="SaaS, ecommerce…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={cancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  link,
}: {
  label: string;
  value: string | null | undefined;
  link?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">
        {value ? (
          link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {value}
            </a>
          ) : (
            <span>{value}</span>
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}
