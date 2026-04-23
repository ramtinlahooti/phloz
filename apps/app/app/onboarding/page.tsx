import { redirect } from 'next/navigation';

import { getCurrentUser } from '@phloz/auth/session';

import { buildAppMetadata } from '@/lib/metadata';

import { OnboardingForm } from './onboarding-form';

export const metadata = buildAppMetadata({ title: 'Create your workspace' });

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?redirect_to=/onboarding');
  if (user.activeWorkspaceId) redirect(`/${user.activeWorkspaceId}`);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Create your workspace
        </h1>
        <p className="mt-2 text-muted-foreground">
          Name your agency. You can invite teammates and add clients after.
        </p>
      </header>

      <div className="w-full rounded-xl border border-border/60 bg-card/30 p-6">
        <OnboardingForm userEmail={user.email ?? ''} />
      </div>
    </div>
  );
}
