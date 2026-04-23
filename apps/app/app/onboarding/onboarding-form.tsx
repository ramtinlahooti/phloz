'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button, Input, Label } from '@phloz/ui';

import { createWorkspaceAction } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating workspace…' : 'Create workspace'}
    </Button>
  );
}

export function OnboardingForm({ userEmail }: { userEmail: string }) {
  const [state, formAction] = useActionState(createWorkspaceAction, {
    error: null as string | null,
  });

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={60}
          autoFocus
          placeholder="Acme Agency"
        />
        <p className="text-xs text-muted-foreground">
          Signed in as {userEmail}.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-[var(--color-destructive)]">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}
