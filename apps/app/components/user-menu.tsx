'use client';

import { LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { resetClient, track } from '@phloz/analytics';
import { createBrowserSupabase } from '@phloz/auth/client';
import {
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@phloz/ui';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function UserMenu({
  user,
  currentWorkspaceId,
}: {
  user: { id: string; email: string; name: string };
  currentWorkspaceId: string;
}) {
  const router = useRouter();

  async function signOut() {
    // Track + reset PostHog before the session drops so the final event
    // is still attributed to the departing user.
    void track('logout', {});
    resetClient();
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]">
        <Avatar className="size-7">
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {user.email}
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link
            href={`/${currentWorkspaceId}/settings`}
            className="flex items-center gap-2"
          >
            <User className="size-4" />
            Profile & settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="flex items-center gap-2">
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
