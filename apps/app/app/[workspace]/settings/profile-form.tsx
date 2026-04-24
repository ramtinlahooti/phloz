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
  Label,
  toast,
} from '@phloz/ui';

import { updateUserProfileAction } from './profile-actions';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Required').max(120),
});
type Values = z.infer<typeof schema>;

/**
 * Profile pane on the Settings page. Editable name, read-only email
 * (Supabase has its own change-email flow that we don't re-wrap).
 * Password changes go through the forgot-password flow.
 */
export function ProfileForm({
  initial,
}: {
  initial: { fullName: string; email: string };
}) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: initial.fullName },
  });

  async function onSubmit(values: Values) {
    const res = await updateUserProfileAction({ fullName: values.fullName });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Profile saved');
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Alex Chen" {...field} />
              </FormControl>
              <FormDescription>
                Shown in the sidebar, on tasks you create, and in emails
                sent to clients.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={initial.email} disabled readOnly />
          <p className="text-xs text-muted-foreground">
            Changing your email goes through Supabase&apos;s confirmation
            flow — ask support if you need to switch.
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
          >
            {form.formState.isSubmitting ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
