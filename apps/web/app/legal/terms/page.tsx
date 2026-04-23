import { buildMetadata } from '@/lib/metadata';

export const metadata = buildMetadata({
  title: 'Terms of Service',
  description: 'Phloz terms of service.',
  path: '/legal/terms',
});

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: April 23, 2026
        </p>
      </header>

      <div className="phloz-prose">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of Phloz (the &quot;Service&quot;), operated by Phloz
          (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By creating an
          account or using the Service, you agree to these Terms.
        </p>

        <p className="rounded-md border border-border/60 bg-muted/50 p-4 text-sm">
          <strong>Draft notice.</strong> Phloz is pre-launch. This page is a
          placeholder written for the foundation scaffold. Final ToS will be
          published before the first paying customer is onboarded and will be
          reviewed by counsel. If you have questions in the meantime, email{' '}
          <a href="mailto:legal@phloz.com">legal@phloz.com</a>.
        </p>

        <h2>1. Your account</h2>
        <p>
          You must provide accurate information when creating an account. You
          are responsible for all activity under your account and for keeping
          your credentials secure.
        </p>

        <h2>2. Acceptable use</h2>
        <p>
          You agree not to use the Service to: (a) violate any law; (b)
          infringe intellectual property rights; (c) transmit malware; (d)
          attempt to gain unauthorized access to other workspaces; (e) send
          spam or unsolicited marketing emails via the Service.
        </p>

        <h2>3. Subscription and fees</h2>
        <p>
          Paid plans are billed in advance monthly or annually. Fees are
          non-refundable except as required by law or explicitly stated in
          these Terms. We offer a 30-day money-back guarantee on first
          payments.
        </p>

        <h2>4. Your data</h2>
        <p>
          You retain ownership of all content you upload to Phloz. You grant
          us a limited licence to host, process, and display your content
          solely to provide the Service. We will not sell or share your
          content with third parties except as described in our Privacy
          Policy.
        </p>

        <h2>5. Service availability</h2>
        <p>
          We work to keep the Service available 24/7 but do not guarantee
          uninterrupted access. Scheduled maintenance will be announced in
          advance where possible.
        </p>

        <h2>6. Termination</h2>
        <p>
          You may cancel your subscription at any time from the billing
          settings. We may suspend or terminate accounts that violate these
          Terms. Upon termination, you may export your data for 30 days
          before it is deleted.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, our aggregate liability for
          any claim arising from these Terms is limited to the amount you paid
          us in the 12 months preceding the claim.
        </p>

        <h2>8. Governing law</h2>
        <p>
          These Terms are governed by the laws of British Columbia, Canada.
          Any disputes will be resolved in the courts of Vancouver, BC.
        </p>

        <h2>9. Changes</h2>
        <p>
          We may update these Terms occasionally. Material changes will be
          announced by email or in-app notice at least 30 days in advance.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about these Terms? Email{' '}
          <a href="mailto:legal@phloz.com">legal@phloz.com</a>.
        </p>
      </div>
    </div>
  );
}
