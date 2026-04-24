'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Link as LinkIcon, Plus, Send, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  toast,
} from '@phloz/ui';

import {
  createContactAction,
  deleteContactAction,
  generatePortalLinkAction,
  togglePortalAccessAction,
} from './actions';

export type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  portalAccess: boolean;
};

export function ContactsPanel({
  workspaceId,
  clientId,
  contacts,
}: {
  workspaceId: string;
  clientId: string;
  contacts: ContactRow[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {contacts.length} contact{contacts.length === 1 ? '' : 's'} ·{' '}
          {contacts.filter((c) => c.portalAccess).length} with portal access
        </p>
        <NewContactDialog workspaceId={workspaceId} clientId={clientId} />
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          title="No contacts yet"
          description="Add the client's stakeholders here. Grant portal access to email them a magic link."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60">
              {contacts.map((c) => (
                <ContactRowView
                  key={c.id}
                  workspaceId={workspaceId}
                  contact={c}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- New contact dialog -----------------------------------------------
const newSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(200),
  email: z
    .string()
    .email('Enter a valid email or leave blank')
    .optional()
    .or(z.literal('')),
  phone: z.string().max(60).optional(),
  role: z.string().max(100).optional(),
  portalAccess: z.boolean().default(false),
});

type NewValues = z.infer<typeof newSchema>;

function NewContactDialog({
  workspaceId,
  clientId,
}: {
  workspaceId: string;
  clientId: string;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<NewValues>({
    resolver: zodResolver(newSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      role: '',
      portalAccess: false,
    },
  });

  async function onSubmit(values: NewValues) {
    const res = await createContactAction({
      workspaceId,
      clientId,
      name: values.name,
      email: values.email || undefined,
      phone: values.phone || undefined,
      role: values.role || undefined,
      portalAccess: values.portalAccess,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Contact added');
    setOpen(false);
    form.reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-3.5" /> New contact
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
          <DialogDescription>
            Stakeholders you work with at this client. Portal access lets
            them sign in via magic link to see shared tasks and
            conversations.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Alex Chen" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="alex@acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="VP Marketing" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="portalAccess"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div className="space-y-0.5">
                    <Label>Portal access</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow this contact to be sent a portal magic link.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Adding…' : 'Add contact'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// --- Row with inline actions ------------------------------------------
function ContactRowView({
  workspaceId,
  contact,
}: {
  workspaceId: string;
  contact: ContactRow;
}) {
  const [, startTransition] = useTransition();
  const [linkBusy, setLinkBusy] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const res = await togglePortalAccessAction({
        workspaceId,
        contactId: contact.id,
        portalAccess: !contact.portalAccess,
      });
      if (!res.ok) toast.error(res.error);
    });
  }

  async function remove() {
    if (!confirm(`Remove ${contact.name} from this client?`)) return;
    const res = await deleteContactAction({
      workspaceId,
      contactId: contact.id,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Removed');
  }

  async function sendLink(sendEmail: boolean) {
    setLinkBusy(true);
    try {
      const res = await generatePortalLinkAction({
        workspaceId,
        contactId: contact.id,
        sendEmail,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setGeneratedUrl(res.url);
      if (res.emailed) {
        toast.success(`Magic link emailed to ${contact.email}`);
      } else {
        toast.success('Magic link ready — copy it below');
      }
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyUrl() {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed — select manually');
    }
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="truncate font-medium">{contact.name}</span>
            {contact.role && (
              <Badge variant="outline" className="text-[10px]">
                {contact.role}
              </Badge>
            )}
            {contact.portalAccess && (
              <Badge
                variant="outline"
                className="border-primary/40 text-[10px] text-primary"
              >
                Portal access
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            {contact.email && <span>{contact.email}</span>}
            {contact.phone && <span>{contact.phone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={toggle}
            title={
              contact.portalAccess
                ? 'Revoke portal access'
                : 'Grant portal access'
            }
          >
            {contact.portalAccess ? 'Revoke' : 'Grant portal'}
          </Button>
          {contact.portalAccess && contact.email && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => sendLink(true)}
              disabled={linkBusy}
              title="Email a fresh magic link"
              className="gap-1.5"
            >
              <Send className="size-3.5" /> Email link
            </Button>
          )}
          {contact.portalAccess && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => sendLink(false)}
              disabled={linkBusy}
              title="Generate a magic link without emailing"
              className="gap-1.5"
            >
              <LinkIcon className="size-3.5" /> Copy link
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={remove}
            title="Remove"
          >
            <Trash2 className="size-3.5 text-red-400" />
          </Button>
        </div>
      </div>

      {generatedUrl && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">
            {generatedUrl}
          </code>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={copyUrl}
            className="gap-1.5"
          >
            <Copy className="size-3.5" />
            Copy
          </Button>
        </div>
      )}
    </li>
  );
}
