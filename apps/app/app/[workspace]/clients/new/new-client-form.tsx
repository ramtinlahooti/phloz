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
  name: z.string().trim().min(1, 'Client name is required').max(80),
  businessName: z.string().trim().max(120).optional(),
  websiteUrl: websiteFormFieldSchema,
  industry: z.string().trim().max(60).optional(),
});

type Values = z.infer<typeof schema>;

export function NewClientForm({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      businessName: '',
      websiteUrl: '',
      industry: '',
    },
  });

  async function onSubmit(values: Values) {
    const res = await fetch(`/api/workspaces/${workspaceId}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: values.name,
        businessName: values.businessName || null,
        websiteUrl: values.websiteUrl,
        industry: values.industry || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not add client');
      return;
    }
    const { id } = (await res.json()) as { id: string };
    toast.success('Client added');
    router.push(`/${workspaceId}/clients/${id}`);
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
              <FormLabel>Client name</FormLabel>
              <FormControl>
                <Input autoFocus placeholder="Acme Inc." {...field} />
              </FormControl>
              <FormDescription>
                The internal name you&apos;ll refer to this client by.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Legal business name (optional)</FormLabel>
              <FormControl>
                <Input placeholder="Acme Inc., Ltd." {...field} />
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
              <FormLabel>Website (optional)</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  placeholder="https://acme.com"
                  {...field}
                />
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
              <FormLabel>Industry (optional)</FormLabel>
              <FormControl>
                <Input placeholder="SaaS, ecommerce…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? 'Adding…' : 'Add client'}
        </Button>
      </form>
    </Form>
  );
}
