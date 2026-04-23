import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Privacy Policy',
  description: 'Phloz privacy policy.',
  path: '/legal/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: April 23, 2026
        </p>
      </header>

      <div className="phloz-prose">
        <p>
          This Privacy Policy explains how Phloz (&quot;we&quot;,
          &quot;us&quot;) collects, uses, and shares information about you
          when you use our website and Service.
        </p>

        <p className="rounded-md border border-border/60 bg-muted/50 p-4 text-sm">
          <strong>Draft notice.</strong> This page is a placeholder written
          for the foundation scaffold. Final Privacy Policy will be published
          before the first paying customer is onboarded and will be reviewed
          by counsel. Questions in the meantime:{' '}
          <a href="mailto:privacy@phloz.com">privacy@phloz.com</a>.
        </p>

        <h2>1. Information we collect</h2>
        <p>
          <strong>Account data:</strong> email, name, workspace name, billing
          information (processed by Stripe; we don&apos;t store card numbers).
        </p>
        <p>
          <strong>Content data:</strong> anything you put into Phloz —
          clients, tasks, messages, tracking map entries, files.
        </p>
        <p>
          <strong>Usage data:</strong> pages visited, features used, event
          logs. We use Google Analytics 4, Google Tag Manager, and PostHog
          for product analytics.
        </p>
        <p>
          <strong>Cookies:</strong> authentication session cookies (required)
          and analytics cookies (optional, governed by your consent where
          required by law).
        </p>

        <h2>2. How we use information</h2>
        <p>
          To provide the Service, authenticate you, process payments, send
          transactional emails, improve the product, detect abuse, comply
          with law.
        </p>

        <h2>3. Sharing</h2>
        <p>
          We share data only with sub-processors necessary to provide the
          Service: Supabase (hosting + auth + database), Vercel (hosting),
          Stripe (payments), Resend (transactional email), Sentry (error
          monitoring), PostHog (analytics). A full sub-processor list is
          available on request.
        </p>
        <p>
          We never sell your data.
        </p>

        <h2>4. Data location and transfers</h2>
        <p>
          Data is stored in the US (Supabase, Vercel). If you are in the EU
          or UK, data transfers rely on Standard Contractual Clauses.
        </p>

        <h2>5. Data retention</h2>
        <p>
          We retain account data for as long as your workspace is active and
          for 30 days after cancellation (to allow exports). After that, data
          is deleted or anonymised. Analytics logs are retained for 26 months.
        </p>

        <h2>6. Your rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct,
          delete, or export your data. Email{' '}
          <a href="mailto:privacy@phloz.com">privacy@phloz.com</a> to exercise
          any of these rights.
        </p>

        <h2>7. Security</h2>
        <p>
          Phloz uses row-level security (RLS) for tenant isolation,
          ECC P-256 JWT signing, Stripe for payments, and encrypted transport
          (TLS) for all traffic. Security is an ongoing program — SOC 2 is on
          the roadmap.
        </p>

        <h2>8. Children</h2>
        <p>
          Phloz is not directed to children under 16 and we do not knowingly
          collect data from them.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update this Privacy Policy from time to time. Material
          changes will be announced by email or in-app notice.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions? Email{' '}
          <a href="mailto:privacy@phloz.com">privacy@phloz.com</a>.
        </p>
      </div>
    </div>
  );
}
