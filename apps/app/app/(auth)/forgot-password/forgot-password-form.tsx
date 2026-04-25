'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { track } from '@phloz/analytics';
import { createBrowserSupabase } from '@phloz/auth/client';

import { getClientAppUrl } from '@/lib/client-app-url';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  toast,
} from '@phloz/ui';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

type Values = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: Values) {
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${getClientAppUrl()}/auth/callback?next=/reset-password`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    void track('password_reset_requested', {});
    toast.success('Check your email', {
      description: 'If an account exists we\'ve sent a reset link.',
    });
    form.reset();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
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
          {form.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </Form>
  );
}
