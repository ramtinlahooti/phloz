import Link from 'next/link';
import {
  AtSign,
  ExternalLink,
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
  /**
   * Optional per-nav-item count badges. Keys are nav hrefs
   * (e.g. `"tasks"`, `"messages"`); values are the number to show.
   * Zero / undefined = no badge. Computed server-side in the
   * workspace layout so they're fresh on every page load.
   */
  navBadges?: {
    tasks?: number;
    messages?: number;
    mentions?: number;
  };
  children: React.ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Identifier used to look up the badge count. */
  badgeKey?: keyof NonNullable<DashboardShellProps['navBadges']>;
  /** Tooltip shown on hover over the badge — describes what the
   *  number counts. Helps with discoverability. */
  badgeTitle?: string;
  /** Which colour family the badge takes. Red is for overdue signals,
   *  amber for attention-worthy but not urgent. */
  badgeTone?: 'red' | 'amber';
};

export function DashboardShell({
  workspace,
  role,
  user,
  allWorkspaces,
  navBadges,
  children,
}: DashboardShellProps) {
  const base = `/${workspace.id}`;
  const nav: NavItem[] = [
    { label: 'Overview', href: base, icon: LayoutDashboard },
    { label: 'Clients', href: `${base}/clients`, icon: Users },
    {
      label: 'Tasks',
      href: `${base}/tasks`,
      icon: ListChecks,
      badgeKey: 'tasks',
      badgeTitle: 'Overdue tasks assigned to you',
      badgeTone: 'red',
    },
    {
      label: 'Messages',
      href: `${base}/messages`,
      icon: MessagesSquare,
      badgeKey: 'messages',
      badgeTitle: 'Clients waiting on a reply',
      badgeTone: 'amber',
    },
    {
      label: 'Mentions',
      href: `${base}/mentions`,
      icon: AtSign,
      badgeKey: 'mentions',
      badgeTitle: 'New @-mentions since you last looked',
      badgeTone: 'amber',
    },
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
          {filteredNav.map((item) => {
            const count =
              item.badgeKey && navBadges
                ? navBadges[item.badgeKey] ?? 0
                : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <item.icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span
                    title={item.badgeTitle}
                    className={`inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full border px-1.5 py-px text-[10px] font-semibold ${
                      item.badgeTone === 'red'
                        ? 'border-red-400/50 text-red-400'
                        : 'border-amber-400/50 text-amber-400'
                    }`}
                    aria-label={`${count} ${item.badgeTitle ?? item.label}`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/60 p-3">
          <MarketingLink />
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

/**
 * Sidebar link out to the marketing site. Lets logged-in users
 * jump back to the public-facing pages — pricing, blog, the
 * tracking-map landing — without typing the URL or losing the
 * tab. `target="_blank"` so the app session stays put. URL is
 * env-driven; the fallback matches `apps/web/lib/site-config.ts`.
 */
function MarketingLink() {
  const url = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://phloz.com';
  return (
    <Link
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ExternalLink className="size-3.5" />
      <span className="flex-1">Marketing site</span>
    </Link>
  );
}
