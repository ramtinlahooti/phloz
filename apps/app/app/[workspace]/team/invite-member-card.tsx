'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Card,
  CardContent,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@phloz/ui';

const schema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

type Values = z.infer<typeof schema>;

export function InviteMemberCard({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member' },
  });

  async function onSubmit(values: Values) {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/invitations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not send invitation');
      return;
    }
    toast.success('Invitation sent');
    form.reset();
    // Refresh so the pending-invites section shows the new row
    // without a manual reload.
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold">Invite a teammate</h3>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="sr-only">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="teammate@agency.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel className="sr-only">Role</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer (free)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              Send invite
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
