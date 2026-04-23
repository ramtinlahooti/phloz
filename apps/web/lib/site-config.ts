/**
 * Central marketing-site config. One source of truth for URLs, nav,
 * footer links, and SEO defaults. Change here = change everywhere.
 */

export const SITE_CONFIG = {
  name: 'Phloz',
  tagline: 'CRM + work management + marketing tracking, built for agencies.',
  description:
    'Phloz is the all-in-one platform for digital marketing agencies: CRM, project management, and a typed tracking-infrastructure map that tells you exactly where every pixel, conversion, and audience lives — across every client.',
  url:
    process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://phloz.com',
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.phloz.com',
  twitter: '@phlozhq',
  locale: 'en_US',
  themeColor: '#0b0f17',
} as const;

/** Primary nav shown in the site header. Kept short (4 items). */
export const PRIMARY_NAV = [
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Blog', href: '/blog' },
  { label: 'Compare', href: '/compare/hubspot' },
] as const;

/** Footer sitemap columns. Ordered left→right in the footer. */
export const FOOTER_NAV = {
  product: {
    label: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Integrations', href: '/integrations' },
      { label: 'Help', href: '/help' },
    ],
  },
  useCases: {
    label: 'Use cases',
    links: [
      { label: 'Client onboarding audit', href: '/use-cases/client-onboarding-audit' },
      { label: 'Tracking infrastructure map', href: '/use-cases/tracking-infrastructure-map' },
      { label: 'Cross-client reporting', href: '/use-cases/cross-client-reporting' },
      { label: 'Agency PM', href: '/use-cases/agency-pm' },
    ],
  },
  crmFor: {
    label: 'CRM for',
    links: [
      { label: 'PPC agencies', href: '/crm-for/ppc' },
      { label: 'SEO agencies', href: '/crm-for/seo' },
      { label: 'Social media agencies', href: '/crm-for/social-media' },
      { label: 'Web design agencies', href: '/crm-for/web-design' },
    ],
  },
  company: {
    label: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  legal: {
    label: 'Legal',
    links: [
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Privacy', href: '/legal/privacy' },
    ],
  },
} as const;

/**
 * Programmatic-SEO registries. Kept in code so that sitemap generation,
 * `generateStaticParams`, and nav links share one source of truth.
 * Add an entry here → page auto-included in sitemap + llms.txt.
 */
export const COMPETITORS = [
  { slug: 'hubspot', name: 'HubSpot' },
  { slug: 'monday', name: 'Monday.com' },
  { slug: 'clickup', name: 'ClickUp' },
  { slug: 'asana', name: 'Asana' },
  { slug: 'notion', name: 'Notion' },
  { slug: 'teamwork', name: 'Teamwork' },
  { slug: 'productive', name: 'Productive' },
  { slug: 'rocketlane', name: 'Rocketlane' },
  { slug: 'functionpoint', name: 'Function Point' },
  { slug: 'accelo', name: 'Accelo' },
] as const;

export const USE_CASES = [
  { slug: 'client-onboarding-audit', name: 'Client onboarding audit' },
  { slug: 'tracking-infrastructure-map', name: 'Tracking infrastructure map' },
  { slug: 'cross-client-reporting', name: 'Cross-client reporting' },
  { slug: 'agency-pm', name: 'Agency project management' },
] as const;

export const DEPARTMENTS = [
  { slug: 'ppc', name: 'PPC' },
  { slug: 'seo', name: 'SEO' },
  { slug: 'social-media', name: 'Social media' },
  { slug: 'cro', name: 'CRO' },
  { slug: 'web-design', name: 'Web design' },
  { slug: 'performance-marketing', name: 'Performance marketing' },
  { slug: 'ecommerce', name: 'Ecommerce' },
  { slug: 'b2b', name: 'B2B' },
] as const;

export const INTEGRATIONS = [
  { slug: 'ga4', name: 'Google Analytics 4', category: 'Analytics' },
  { slug: 'gtm', name: 'Google Tag Manager', category: 'Tag management' },
  { slug: 'google-ads', name: 'Google Ads', category: 'Paid' },
  { slug: 'meta-ads', name: 'Meta Ads', category: 'Paid' },
  { slug: 'tiktok-ads', name: 'TikTok Ads', category: 'Paid' },
  { slug: 'microsoft-ads', name: 'Microsoft Ads', category: 'Paid' },
  { slug: 'shopify', name: 'Shopify', category: 'Commerce' },
  { slug: 'klaviyo', name: 'Klaviyo', category: 'Email' },
  { slug: 'hubspot', name: 'HubSpot', category: 'CRM' },
] as const;

export type CompetitorSlug = (typeof COMPETITORS)[number]['slug'];
export type UseCaseSlug = (typeof USE_CASES)[number]['slug'];
export type DepartmentSlug = (typeof DEPARTMENTS)[number]['slug'];
export type IntegrationSlug = (typeof INTEGRATIONS)[number]['slug'];
