'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { track } from '@phloz/analytics';
import { createBrowserSupabase } from '@phloz/auth/client';
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

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect_to') ?? '/';
  const [magicLinkSending, setMagicLinkSending] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values: LoginValues) {
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    void track('login', { method: 'email' });
    router.push(redirectTo);
    router.refresh();
  }

  async function sendMagicLink() {
    const email = form.getValues('email');
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) {
      form.setError('email', { message: 'Enter a valid email to get a link' });
      return;
    }
    setMagicLinkSending(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      // Magic-link send itself isn't in the event taxonomy — `login`
      // fires on the callback return (method: magic_link) where we
      // know the auth actually succeeded.
      toast.success('Check your email', {
        description: 'We sent a magic link. Click it to sign in.',
      });
    } finally {
      setMagicLinkSending(false);
    }
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
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="you@agency.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
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
          {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="relative py-2 text-center text-xs text-muted-foreground">
          <span className="bg-background px-2">or</span>
          <span className="absolute left-0 top-1/2 -z-10 h-px w-full bg-border/60" aria-hidden />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={sendMagicLink}
          disabled={magicLinkSending}
        >
          {magicLinkSending ? 'Sending…' : 'Email me a magic link'}
        </Button>
      </form>
    </Form>
  );
}
