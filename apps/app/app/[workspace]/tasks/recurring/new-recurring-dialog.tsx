'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_VISIBILITIES,
} from '@phloz/config';

import {
  RECURRING_CADENCES,
  WEEKDAYS,
  describeCadence,
  type RecurringCadence,
} from './cadence';
import { createRecurringTemplateAction } from './actions';

const UNASSIGNED = '__unassigned__';
const NO_CLIENT = '__none__';

const schema = z.object({
  title: z.string().trim().min(1, 'Required').max(200),
  description: z.string().max(4000).optional(),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  department: z.enum(DEPARTMENTS).default('other'),
  visibility: z.enum(TASK_VISIBILITIES).default('internal'),
  cadence: z.enum(RECURRING_CADENCES).default('weekly'),
  weekday: z.string().default('1'),
  dayOfMonth: z.string().default('1'),
  dueOffsetDays: z.string().default('0'),
  clientId: z.string().default(NO_CLIENT),
  assigneeMembershipId: z.string().default(UNASSIGNED),
});

type Values = z.infer<typeof schema>;

type Props = {
  workspaceId: string;
  /** When supplied, the template is fixed to this client and the
   *  client picker is hidden (matches `NewTaskDialog`'s behaviour). */
  clientId?: string | null;
  clients?: { id: string; name: string }[];
  members?: { id: string; label: string }[];
};

export function NewRecurringDialog({
  workspaceId,
  clientId,
  clients,
  members,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'medium',
      department: 'other',
      visibility: 'internal',
      cadence: 'weekly',
      weekday: '1',
      dayOfMonth: '1',
      dueOffsetDays: '0',
      clientId: clientId ?? NO_CLIENT,
      assigneeMembershipId: UNASSIGNED,
    },
  });

  const watchedCadence = form.watch('cadence');
  const watchedWeekday = parseInt(form.watch('weekday') ?? '1', 10);
  const watchedDayOfMonth = parseInt(form.watch('dayOfMonth') ?? '1', 10);

  const cadencePreview = describeCadence({
    cadence: watchedCadence,
    weekday: Number.isFinite(watchedWeekday) ? watchedWeekday : null,
    dayOfMonth: Number.isFinite(watchedDayOfMonth) ? watchedDayOfMonth : null,
  });

  async function onSubmit(values: Values) {
    const cadence = values.cadence as RecurringCadence;
    const dueOffset = Math.max(0, parseInt(values.dueOffsetDays, 10) || 0);
    const effectiveClientId =
      clientId ??
      (values.clientId && values.clientId !== NO_CLIENT
        ? values.clientId
        : null);
    const res = await createRecurringTemplateAction({
      workspaceId,
      clientId: effectiveClientId,
      title: values.title,
      description: values.description || null,
      priority: values.priority,
      department: values.department,
      visibility: values.visibility,
      assigneeMembershipId:
        values.assigneeMembershipId &&
        values.assigneeMembershipId !== UNASSIGNED
          ? values.assigneeMembershipId
          : null,
      dueOffsetDays: dueOffset,
      cadence,
      weekday:
        cadence === 'weekly'
          ? parseInt(values.weekday, 10)
          : null,
      dayOfMonth:
        cadence === 'monthly'
          ? parseInt(values.dayOfMonth, 10)
          : null,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Recurring template created');
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-3.5" />
        New recurring task
      </Button>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New recurring task</DialogTitle>
          <DialogDescription>{cadencePreview}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="cadence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cadence</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RECURRING_CADENCES.map((c) => (
                          <SelectItem key={c} value={c} className="capitalize">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {watchedCadence === 'weekly' && (
                <FormField
                  control={form.control}
                  name="weekday"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weekday</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WEEKDAYS.map((name, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              {watchedCadence === 'monthly' && (
                <FormField
                  control={form.control}
                  name="dayOfMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day of month</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={31} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d} className="capitalize">
                            {d.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_VISIBILITIES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {v === 'internal' ? 'Internal' : 'Client-visible'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dueOffsetDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due in N days (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={365} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {members && members.length > 0 && (
                <FormField
                  control={form.control}
                  name="assigneeMembershipId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignee (optional)</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
              {!clientId && clients && clients.length > 0 && (
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client (optional)</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_CLIENT}>No client</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
