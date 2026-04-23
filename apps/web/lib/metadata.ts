import type { Metadata } from 'next';

import { SITE_CONFIG } from './site-config';

type BuildMetadataArgs = {
  title?: string;
  description?: string;
  path?: string;
  /** Override the OG image path. Defaults to `/og/default.png`. */
  ogImage?: string;
  /** Mark a page as noindex (thank-you pages, admin previews, etc.). */
  noindex?: boolean;
};

/**
 * Single entry point for page-level `generateMetadata`. Guarantees a
 * consistent title template, canonical URL, Open Graph, Twitter card,
 * and robots directives across the whole site.
 *
 * Usage in a page file:
 * ```ts
 * export const metadata = buildMetadata({
 *   title: 'Pricing',
 *   description: 'Simple, predictable per-client pricing for agencies.',
 *   path: '/pricing',
 * });
 * ```
 */
export function buildMetadata({
  title,
  description = SITE_CONFIG.description,
  path = '/',
  ogImage = '/og/default.png',
  noindex = false,
}: BuildMetadataArgs = {}): Metadata {
  const fullTitle = title
    ? `${title} · ${SITE_CONFIG.name}`
    : `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`;
  const url = `${SITE_CONFIG.url}${path}`;
  const ogImageUrl = ogImage.startsWith('http')
    ? ogImage
    : `${SITE_CONFIG.url}${ogImage}`;

  return {
    metadataBase: new URL(SITE_CONFIG.url),
    title: fullTitle,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      locale: SITE_CONFIG.locale,
      url,
      siteName: SITE_CONFIG.name,
      title: fullTitle,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      site: SITE_CONFIG.twitter,
      creator: SITE_CONFIG.twitter,
      images: [ogImageUrl],
    },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
  };
}

/** Organisation JSON-LD for the site-wide structured data. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    logo: `${SITE_CONFIG.url}/logo.png`,
    description: SITE_CONFIG.description,
    sameAs: [`https://twitter.com/${SITE_CONFIG.twitter.replace('@', '')}`],
  } as const;
}

/** SoftwareApplication JSON-LD for the product itself. */
export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_CONFIG.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: SITE_CONFIG.description,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
  } as const;
}
