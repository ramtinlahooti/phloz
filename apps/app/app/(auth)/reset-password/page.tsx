import { buildAppMetadata } from '@/lib/metadata';

import { ResetPasswordForm } from './reset-password-form';

export const metadata = buildAppMetadata({ title: 'Set new password' });

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Set a new password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use at least 8 characters.
        </p>
      </header>

      <ResetPasswordForm />
    </div>
  );
}
