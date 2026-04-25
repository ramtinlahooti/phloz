'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@phloz/ui';

import { websiteFormFieldSchema } from '@/lib/url-input';

const schema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(60),
  description: z.string().max(1000).optional(),
  websiteUrl: websiteFormFieldSchema,
  timezone: z.string().max(64).optional(),
});

type Values = z.infer<typeof schema>;

export function WorkspaceSettingsForm({
  workspace,
}: {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string;
    websiteUrl: string;
    timezone: string;
  };
}) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: workspace.name,
      description: workspace.description,
      websiteUrl: workspace.websiteUrl,
      timezone: workspace.timezone,
    },
  });

  async function onSubmit(values: Values) {
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        websiteUrl: values.websiteUrl?.trim() || null,
        timezone: values.timezone?.trim() || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not save');
      return;
    }
    toast.success('Saved');
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Agency name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormDescription>
                Slug:{' '}
                <span className="font-mono">{workspace.slug}</span> — used
                in emails, not editable yet.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <textarea
                  {...field}
                  rows={3}
                  maxLength={1000}
                  placeholder="What does your agency do? Who are your clients? One or two sentences."
                  className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </FormControl>
              <FormDescription>
                Appears on invitation emails and the portal landing header
                once those surfaces pick it up. Max 1,000 characters.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="websiteUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Website</FormLabel>
                <FormControl>
                  <Input
                    type="url"
                    placeholder="https://acme-agency.com"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <FormControl>
                  <Input placeholder="America/Vancouver" {...field} />
                </FormControl>
                <FormDescription>
                  IANA name (e.g. <code>America/Vancouver</code>,{' '}
                  <code>Europe/London</code>). Used for rendering dates in
                  the agency UI.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
          >
            {form.formState.isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
