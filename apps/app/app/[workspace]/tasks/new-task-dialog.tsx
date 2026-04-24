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

import { createTaskAction } from './actions';

const schema = z.object({
  title: z.string().trim().min(1, 'Required').max(200),
  description: z.string().max(4000).optional(),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  department: z.enum(DEPARTMENTS).default('other'),
  visibility: z.enum(TASK_VISIBILITIES).default('internal'),
  dueDate: z.string().optional(),
  /**
   * `__none__` = workspace-level (no client). Any other string is a
   * client id. Kept inside the form so `form.reset()` clears it too
   * and there's no stale-state window on submit.
   */
  clientId: z.string().default('__none__'),
});

type Values = z.infer<typeof schema>;

type Props = {
  workspaceId: string;
  /** When supplied, the task is attached to this client; otherwise workspace-scoped. */
  clientId?: string | null;
  clients?: { id: string; name: string }[];
  trigger?: React.ReactNode;
};

export function NewTaskDialog({ workspaceId, clientId, clients, trigger }: Props) {
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
      dueDate: '',
      clientId: clientId ?? '__none__',
    },
  });

  async function onSubmit(values: Values) {
    const effectiveClientId =
      clientId ?? // scoped dialog — always attach
      (values.clientId && values.clientId !== '__none__'
        ? values.clientId
        : null);

    const res = await createTaskAction({
      workspaceId,
      clientId: effectiveClientId,
      title: values.title,
      description: values.description || null,
      priority: values.priority,
      department: values.department,
      visibility: values.visibility,
      status: 'todo',
      dueDate: values.dueDate
        ? new Date(values.dueDate).toISOString()
        : null,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Task created');
    setOpen(false);
    form.reset({
      title: '',
      description: '',
      priority: 'medium',
      department: 'other',
      visibility: 'internal',
      dueDate: '',
      clientId: clientId ?? '__none__',
    });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <div onClick={() => setOpen(true)} className="contents">
          {trigger}
        </div>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="size-3.5" />
          New task
        </Button>
      )}

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            {clientId
              ? 'Creating a task under this client.'
              : 'Unclient tasks live at the workspace level — attach one later if you want.'}
          </DialogDescription>
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
                    <FormMessage />
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
                    <FormMessage />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                          <SelectItem value="__none__">No client</SelectItem>
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
                {form.formState.isSubmitting ? 'Creating…' : 'Create task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
