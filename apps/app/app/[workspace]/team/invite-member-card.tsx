'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

export function InviteMemberCard({
  workspaceId,
  clients,
  allMembersSeeAllClients,
}: {
  workspaceId: string;
  /** Active clients in the workspace, name-sorted. Used by the
   *  pre-assignment picker — only meaningful for member + viewer
   *  roles when the workspace policy is "Restricted by assignment". */
  clients: Array<{ id: string; name: string }>;
  /** Workspace policy. When true, pre-assignments save but don't
   *  take effect — the picker tells the user. */
  allMembersSeeAllClients: boolean;
}) {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'member' },
  });
  const [pendingClientIds, setPendingClientIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [showAssignment, setShowAssignment] = useState(false);

  const role = form.watch('role');
  // Pre-assignment is meaningful for member + viewer only. Hidden
  // entirely for admin invites.
  const showAssignmentPicker = role === 'member' || role === 'viewer';

  async function onSubmit(values: Values) {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/invitations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          // Only send the IDs when the role accepts them; the API
          // also strips for admin defensively, but trim here too so
          // the network payload is honest about intent.
          pendingClientIds:
            values.role === 'admin' ? [] : [...pendingClientIds],
        }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? 'Could not send invitation');
      return;
    }
    const count = pendingClientIds.size;
    toast.success(
      count > 0
        ? `Invitation sent · pre-assigned to ${count} client${count === 1 ? '' : 's'}`
        : 'Invitation sent',
    );
    form.reset();
    setPendingClientIds(new Set<string>());
    setShowAssignment(false);
    router.refresh();
  }

  function toggleClient(id: string, next: boolean) {
    setPendingClientIds((prev) => {
      const out = new Set(prev);
      if (next) out.add(id);
      else out.delete(id);
      return out;
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h3 className="text-sm font-semibold">Invite a teammate</h3>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
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
                    <Select
                      value={field.value}
                      onValueChange={(next) => {
                        field.onChange(next);
                        // Clear pre-assignments when switching to admin —
                        // admins always see everything regardless.
                        if (next === 'admin') {
                          setPendingClientIds(new Set<string>());
                          setShowAssignment(false);
                        }
                      }}
                    >
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
            </div>

            {showAssignmentPicker && (
              <div className="rounded-md border border-border/60 bg-card/30 p-3">
                <button
                  type="button"
                  onClick={() => setShowAssignment((s) => !s)}
                  className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
                >
                  <span className="font-medium">
                    Pre-assign clients{' '}
                    {pendingClientIds.size > 0 && (
                      <span className="text-foreground">
                        ({pendingClientIds.size} selected)
                      </span>
                    )}
                  </span>
                  <span>{showAssignment ? '−' : '+'}</span>
                </button>
                {showAssignment && (
                  <div className="mt-3 space-y-3">
                    {allMembersSeeAllClients && (
                      <p className="rounded-md border border-amber-400/40 bg-amber-400/5 px-2 py-1.5 text-[11px] text-amber-400">
                        Workspace policy is currently{' '}
                        <strong>Everyone sees everything</strong>. These
                        assignments save, but won&apos;t take effect
                        until policy is set to{' '}
                        <strong>Restricted by assignment</strong>.
                      </p>
                    )}
                    {clients.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No active clients to pre-assign yet.
                      </p>
                    ) : (
                      <ul className="max-h-48 space-y-1 overflow-y-auto pr-2">
                        {clients.map((c) => {
                          const checked = pendingClientIds.has(c.id);
                          return (
                            <li
                              key={c.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  toggleClient(c.id, e.target.checked)
                                }
                                className="size-3.5 rounded border-border accent-primary"
                              />
                              <span
                                className={
                                  checked
                                    ? 'text-foreground'
                                    : 'text-muted-foreground'
                                }
                              >
                                {c.name}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
