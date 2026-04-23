import type { Metadata } from 'next';

const APP_NAME = 'Phloz';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com';

/**
 * Metadata helper for the product app. Product pages don't need OG
 * images or social card tweaks (they're noindex), so this is a smaller
 * sibling of the marketing-site helper.
 */
export function buildAppMetadata({
  title,
  description = 'The CRM + work management + tracking platform for digital marketing agencies.',
}: {
  title?: string;
  description?: string;
} = {}): Metadata {
  const fullTitle = title ? `${title} · ${APP_NAME}` : APP_NAME;
  return {
    metadataBase: new URL(APP_URL),
    title: fullTitle,
    description,
    robots: { index: false, follow: false },
    icons: {
      icon: '/favicon.ico',
    },
  };
}

export { APP_NAME, APP_URL };
