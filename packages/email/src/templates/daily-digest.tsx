import {
  Button,
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

import { EmailLayout } from './layout';

/** A single task summary row in the digest. */
export interface DigestTaskItem {
  id: string;
  title: string;
  /** Usually "{clientName} · in 2d" / "{clientName} · 3d overdue". */
  subtitle?: string;
  /** Deep-link into the app — typically `/{workspace}/clients/{id}?task={taskId}`. */
  href: string;
}

export interface DigestMessageItem {
  id: string;
  /** Message subject, or the first 80 chars of body if none. */
  preview: string;
  /** Client name + "{N}d waiting". */
  subtitle: string;
  href: string;
}

export interface DigestAuditItem {
  /** Client name. */
  name: string;
  criticalCount: number;
  warningCount: number;
  href: string;
}

export interface DailyDigestEmailProps {
  /** Recipient's display name ("Sarah", "You"). */
  recipientName: string;
  /** Workspace display name, shown in the subject + greeting. */
  workspaceName: string;
  /** "Monday", "Tuesday", … — caller formats in workspace timezone. */
  dayName: string;
  /** Link to open the workspace dashboard. */
  dashboardUrl: string;
  overdue: DigestTaskItem[];
  dueToday: DigestTaskItem[];
  pendingApproval: DigestTaskItem[];
  unrepliedMessages: DigestMessageItem[];
  auditFindings: DigestAuditItem[];
}

/**
 * Daily agenda email. Sent at 9am (UTC for V1) summarising what's on
 * fire in the workspace. Sections are suppressed when empty so a
 * quiet day doesn't produce a sparse email — the sender upstream
 * skips the email entirely when every section is empty.
 */
export function DailyDigestEmail({
  recipientName,
  workspaceName,
  dayName,
  dashboardUrl,
  overdue,
  dueToday,
  pendingApproval,
  unrepliedMessages,
  auditFindings,
}: DailyDigestEmailProps) {
  const totalActionable =
    overdue.length +
    dueToday.length +
    pendingApproval.length +
    unrepliedMessages.length;
  const preview =
    totalActionable === 0
      ? `${dayName} — all quiet on ${workspaceName}.`
      : `${totalActionable} item${totalActionable === 1 ? '' : 's'} on your ${dayName} agenda for ${workspaceName}.`;

  return (
    <EmailLayout preview={preview}>
      <Heading className="m-0 mb-2 text-2xl font-semibold tracking-tight">
        Good morning, {recipientName}.
      </Heading>
      <Text className="m-0 mb-6 text-sm leading-6 text-neutral-700">
        Here&apos;s your <strong>{dayName}</strong> agenda for{' '}
        <strong>{workspaceName}</strong>.
      </Text>

      {overdue.length > 0 && (
        <TaskSection
          title="Overdue"
          accent="#dc2626"
          items={overdue}
        />
      )}
      {dueToday.length > 0 && (
        <TaskSection
          title="Due today"
          accent="#d97706"
          items={dueToday}
        />
      )}
      {pendingApproval.length > 0 && (
        <TaskSection
          title="Pending client approval"
          accent="#0284c7"
          items={pendingApproval}
        />
      )}

      {unrepliedMessages.length > 0 && (
        <Section className="mt-6">
          <SectionHeading title="Waiting on a reply" accent="#7c3aed" />
          {unrepliedMessages.map((m) => (
            <DigestRow
              key={m.id}
              href={m.href}
              title={m.preview}
              subtitle={m.subtitle}
            />
          ))}
        </Section>
      )}

      {auditFindings.length > 0 && (
        <Section className="mt-6">
          <SectionHeading title="Tracking audit" accent="#db2777" />
          {auditFindings.map((f) => {
            const parts: string[] = [];
            if (f.criticalCount > 0) parts.push(`${f.criticalCount} critical`);
            if (f.warningCount > 0)
              parts.push(`${f.warningCount} warning${f.warningCount === 1 ? '' : 's'}`);
            return (
              <DigestRow
                key={f.name}
                href={f.href}
                title={f.name}
                subtitle={parts.join(' · ')}
              />
            );
          })}
        </Section>
      )}

      <Hr className="my-6 border-neutral-200" />

      <Button
        href={dashboardUrl}
        className="rounded-md bg-neutral-900 px-5 py-3 text-sm font-medium text-white"
      >
        Open dashboard
      </Button>

      <Text className="m-0 mt-6 text-xs leading-5 text-neutral-500">
        You&apos;re getting this because you&apos;re a member of{' '}
        {workspaceName} on Phloz. A workspace setting to mute these is
        coming — reply to this email to opt out in the meantime.
      </Text>
    </EmailLayout>
  );
}

/** Reusable colored accent heading for a section. */
function SectionHeading({ title, accent }: { title: string; accent: string }) {
  return (
    <Text
      className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide"
      style={{ color: accent }}
    >
      {title}
    </Text>
  );
}

/** One linked row. Inline-styled rather than Tailwind'd because
 *  react-email's Tailwind runtime has less-reliable cascade on the
 *  hover states we don't need here. */
function DigestRow({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Section className="mb-2 border-l-2 border-neutral-200 pl-3">
      <Link
        href={href}
        className="block text-sm font-medium text-neutral-900 no-underline"
      >
        {title}
      </Link>
      {subtitle && (
        <Text className="m-0 mt-0.5 text-xs leading-5 text-neutral-500">
          {subtitle}
        </Text>
      )}
    </Section>
  );
}

/** Task-section block: coloured heading + up to 5 rows. */
function TaskSection({
  title,
  accent,
  items,
}: {
  title: string;
  accent: string;
  items: DigestTaskItem[];
}) {
  return (
    <Section className="mt-6">
      <SectionHeading title={title} accent={accent} />
      {items.slice(0, 5).map((t) => (
        <DigestRow
          key={t.id}
          href={t.href}
          title={t.title}
          subtitle={t.subtitle}
        />
      ))}
    </Section>
  );
}

DailyDigestEmail.PreviewProps = {
  recipientName: 'Sarah',
  workspaceName: 'Acme Agency',
  dayName: 'Monday',
  dashboardUrl: 'https://app.phloz.com/ws-123',
  overdue: [
    {
      id: '1',
      title: 'Q4 SEO audit — final review',
      subtitle: 'Acme Inc · 2d overdue',
      href: 'https://app.phloz.com/ws-123/clients/c1?task=1',
    },
  ],
  dueToday: [
    {
      id: '2',
      title: 'Send creative brief to client',
      subtitle: 'Beta Co',
      href: 'https://app.phloz.com/ws-123/clients/c2?task=2',
    },
  ],
  pendingApproval: [],
  unrepliedMessages: [
    {
      id: 'm1',
      preview: 'Question about the new tracking setup',
      subtitle: 'Acme Inc · 2d waiting',
      href: 'https://app.phloz.com/ws-123/clients/c1',
    },
  ],
  auditFindings: [
    {
      name: 'Acme Inc',
      criticalCount: 1,
      warningCount: 2,
      href: 'https://app.phloz.com/ws-123/clients/c1?tab=audit',
    },
  ],
} satisfies DailyDigestEmailProps;

export default DailyDigestEmail;
