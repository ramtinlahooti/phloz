import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  ListChecks,
  MessagesSquare,
  CreditCard,
  Settings,
  UsersRound,
} from 'lucide-react';

import type { Role, TierName } from '@phloz/config';

import { CommandPaletteTrigger } from './command-palette-trigger';
import { UserMenu } from './user-menu';
import { WorkspaceSwitcher } from './workspace-switcher';

export type DashboardShellProps = {
  workspace: { id: string; name: string; tier: TierName };
  role: Role;
  user: { id: string; email: string; name: string };
  allWorkspaces: { id: string; name: string; role: Role }[];
  children: React.ReactNode;
};

export function DashboardShell({
  workspace,
  role,
  user,
  allWorkspaces,
  children,
}: DashboardShellProps) {
  const base = `/${workspace.id}`;
  const nav = [
    { label: 'Overview', href: base, icon: LayoutDashboard },
    { label: 'Clients', href: `${base}/clients`, icon: Users },
    { label: 'Tasks', href: `${base}/tasks`, icon: ListChecks },
    { label: 'Messages', href: `${base}/messages`, icon: MessagesSquare },
    { label: 'Team', href: `${base}/team`, icon: UsersRound },
    { label: 'Billing', href: `${base}/billing`, icon: CreditCard },
    { label: 'Settings', href: `${base}/settings`, icon: Settings },
  ];

  // Only owner/admin see billing by default; everyone sees the rest.
  const canSeeBilling = role === 'owner' || role === 'admin';
  const filteredNav = nav.filter(
    (item) => item.href !== `${base}/billing` || canSeeBilling,
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/60 bg-card/30 md:flex">
        <div className="flex h-14 items-center border-b border-border/60 px-4">
          <WorkspaceSwitcher
            currentId={workspace.id}
            workspaces={allWorkspaces}
          />
        </div>
        <div className="px-3 pt-3">
          <CommandPaletteTrigger />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {filteredNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border/60 p-3">
          <UserMenu user={user} currentWorkspaceId={workspace.id} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border/60 bg-card/30 px-4 md:hidden">
          <WorkspaceSwitcher
            currentId={workspace.id}
            workspaces={allWorkspaces}
          />
          <UserMenu user={user} currentWorkspaceId={workspace.id} />
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
