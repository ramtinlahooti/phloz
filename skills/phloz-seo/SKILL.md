---
name: phloz-seo
description: Use this skill whenever creating or modifying pages on the marketing site (apps/web), writing blog posts, adding programmatic SEO templates, or reviewing SEO compliance. Apply when adding new routes under apps/web, writing metadata, adding structured data (JSON-LD), creating comparison or use-case pages, or managing the sitemap. SEO is the primary acquisition channel for Phloz, so every marketing page must be SEO-correct.
---

# Phloz SEO Skill

SEO is Phloz's primary organic acquisition channel. Paid ads for agency software are expensive and low-intent; search traffic converts. Every marketing page must be optimized for discoverability.

## When to apply this skill

Use whenever you:
- Add a new page to `apps/web`
- Write a new blog post
- Create a new programmatic SEO template (`/compare/[x]`, `/use-cases/[x]`, etc.)
- Modify metadata, structured data, or sitemap
- Review a PR for SEO compliance

## Rendering rules

- **All marketing pages: SSG with ISR.** Never SSR a marketing page. `revalidate` values:
  - Homepage, pricing, features: `revalidate: 3600` (1 hour)
  - Blog posts: `revalidate: 86400` (1 day)
  - Programmatic pages: `revalidate: 604800` (1 week)
- **App pages: dynamic + `noindex`.** Never index `app.phloz.com` routes.
- **No JavaScript required** for content to render — search engines must see the full HTML.

## Metadata requirements

Every page in `apps/web` must export `generateMetadata()`:

```typescript
import type { Metadata } from 'next';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: 'Primary keyword | Phloz', // 50-60 chars
    description: 'One-sentence description with primary keyword + benefit. 150-160 chars.',
    alternates: { canonical: `https://phloz.com/path` },
    openGraph: {
      title: 'Primary keyword | Phloz',
      description: '...',
      url: 'https://phloz.com/path',
      siteName: 'Phloz',
      images: [{ url: 'https://phloz.com/og/path.png', width: 1200, height: 630 }],
      type: 'website', // or 'article' for blog posts
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: '...',
      description: '...',
      images: ['https://phloz.com/og/path.png'],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
```

## Title tag rules

- Primary keyword near the start
- Brand suffix: ` | Phloz`
- 50–60 characters total
- Unique across the site
- Describes the content, not just the brand

**Good:** `Best CRM for Digital Marketing Agencies (2026) | Phloz`
**Bad:** `Phloz – Marketing Platform`

## Meta description rules

- 150–160 characters
- Includes primary keyword + value prop + implied CTA
- Not clickbait; must accurately describe the page

**Good:** `Phloz is the CRM and work management platform built for digital marketing agencies. Unified client tracking, GA4 map, team tasks — all in one workspace.`

## Structured data (JSON-LD)

Mandatory schemas:

- **Homepage:** `Organization` + `WebSite` (with `SearchAction`) + `SoftwareApplication`
- **Pricing:** `SoftwareApplication` with `offers` array
- **Blog post:** `Article` with author, datePublished, dateModified + `BreadcrumbList`
- **Comparison pages (`/compare/[x]`):** `Article` or `WebPage` + `BreadcrumbList`
- **FAQ sections on any page:** `FAQPage`
- **All deep pages:** `BreadcrumbList`

Example (blog post):

```tsx
// apps/web/app/blog/[category]/[slug]/page.tsx
export default function BlogPost({ post }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: post.ogImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'Phloz',
      logo: { '@type': 'ImageObject', url: 'https://phloz.com/logo.png' },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* article content */}
    </>
  );
}
```

## Programmatic SEO templates

Phloz ships 4 programmatic SEO templates at V1:

### `/compare/[competitor]`
- Seed list: hubspot, monday, clickup, asana, notion, teamwork, productive, rocketlane, functionpoint, accelo
- Each needs: comparison table, feature breakdown, pricing comparison, "who each is best for," switch-from guide
- Content in `apps/web/content/compare/[slug].mdx` + data file for comparison table

### `/use-cases/[slug]`
- Seed list: client-onboarding-audit, tracking-infrastructure-map, cross-client-reporting, agency-pm, server-side-tracking-setup
- Structure: problem, how Phloz solves it, walkthrough, testimonial placeholder, related resources

### `/crm-for/[department]`
- Seed list: ppc, seo, social-media, cro, web-design, performance-marketing, ecommerce, b2b
- Structure: department-specific pain points, features that solve them, example workflow

### `/integrations/[tool]`
- Seed list: ga4, gtm, google-ads, meta-ads, tiktok-ads, microsoft-ads, shopify, klaviyo, hubspot
- Note: marketing-only in V1 (product integrations are V2). Pages describe the planned integration + signup for early access.

**All four templates:**
- Live under their own folder in `apps/web/app/`
- Use a shared layout component for consistent IA
- Each have a data file (JSON/TS) defining the slugs and page content
- `generateStaticParams()` returns all slugs
- Appear in sitemap

## Blog architecture

### URL structure

- Index: `/blog`
- Category: `/blog/[category]`
- Post: `/blog/[category]/[slug]`
- Tag: `/blog/tag/[tag]` (optional)

Categories (V1):
- `google-analytics`
- `google-tag-manager`
- `meta-ads`
- `google-ads`
- `tiktok-ads`
- `tracking-infrastructure`
- `agency-operations`
- `conversion-tracking`
- `server-side-tracking`
- `agency-growth`

### Post frontmatter

```yaml
---
title: "Best CRM for Digital Marketing Agencies in 2026"
description: "A practical comparison of CRMs built for digital marketing agencies, with real criteria for choosing one."
category: agency-operations
tags: [crm, agency-tools, reviews]
publishedAt: 2026-04-23
updatedAt: 2026-04-23
author: ramtin
ogImage: /og/blog/best-crm-for-digital-marketing-agencies.png
primaryKeyword: "best crm for digital marketing agencies"
---
```

### Post quality rules

- Minimum 1200 words for ranking content; 2000+ for pillar posts
- H1 = title (Next.js handles this automatically)
- One H1 per page. H2s for main sections, H3s for subsections.
- Primary keyword in: title, H1, first 100 words, URL slug, meta description
- Internal links to at least 2 other Phloz pages
- External links to authoritative sources (always `rel="noopener noreferrer"`)
- Original images, not stock where possible
- FAQ section at end when relevant → `FAQPage` JSON-LD

## Sitemap

`apps/web/app/sitemap.ts` generates a full sitemap, including:
- Static routes
- All blog posts (from MDX frontmatter)
- All programmatic SEO template slugs
- Updated `lastModified` from content files

Submit to Google Search Console + Bing Webmaster Tools.

## robots.txt

`apps/web/app/robots.ts`:

```typescript
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/' },
      // Disallow preview deploys
      ...(process.env.VERCEL_ENV === 'production'
        ? []
        : [{ userAgent: '*', disallow: '/' }]),
    ],
    sitemap: 'https://phloz.com/sitemap.xml',
  };
}
```

## llms.txt

`apps/web/app/llms.txt/route.ts` outputs a categorized index of marketing pages for LLM crawlers. Format:

```
# Phloz

> The CRM and work management platform built for digital marketing agencies. Unified client tracking, GA4/GTM infrastructure map, team tasks, client portal.

## Core pages
- [Home](https://phloz.com/): ...
- [Pricing](https://phloz.com/pricing): ...
- [Features](https://phloz.com/features): ...

## Comparisons
- [Phloz vs HubSpot](https://phloz.com/compare/hubspot): ...
...
```

Auto-regenerate when pages change.

## Core Web Vitals

Target scores (Lighthouse):

- Performance: 95+
- Accessibility: 95+
- Best Practices: 100
- SEO: 100

Rules:

- Use `next/image` for all images
- Use `next/font` with subset loading
- Minimize client-side JS on marketing pages (no React Flow on homepage)
- Preload critical resources
- Defer non-critical scripts (GTM is async, PostHog is deferred)
- Images under 100KB, use WebP/AVIF

## Common mistakes

- ❌ Forgetting `alternates.canonical` — Google indexes the wrong URL
- ❌ Title > 60 chars — truncated in SERPs
- ❌ Duplicate titles across pages — Google merges them
- ❌ Missing structured data on blog posts
- ❌ Loading GTM synchronously — hurts LCP
- ❌ Using SSR instead of SSG on marketing pages
- ❌ Forgetting to add new pages to sitemap + llms.txt
- ❌ Using lorem ipsum placeholder content on indexable pages
- ❌ No H1 or multiple H1s per page
- ❌ Keyword stuffing (Google penalizes)

## Tier-1 keywords (primary focus)

From keyword research:

| Keyword | Volume | Competition |
|---|---|---|
| digital marketing crm | 1,600 | Low |
| digital marketing software | 1,300 | Low |
| ppc management software | 480 | Low |
| digital marketing agency software | 390 | Low |
| performance marketing platform | 390 | Low |
| digital marketing automation platform | 320 (+306% YoY) | Low |
| performance marketing software | 320 | Low |
| best software for digital marketing | 320 | Low |
| crm for digital marketing agency | 210 | Low |
| digital marketing agency crm | 210 | Low |
| best ppc management software | 210 | Low |
| marketing asset management software | 210 | Low |
| best crm for digital marketing agency | 110 | Low |
| ppc software for agencies | 110 | Low |
| ppc agency software | 110 | Low |
| ppc management software for agencies | 110 | Low |

Each of these should be the primary keyword for at least one dedicated page (landing page, blog post, or programmatic SEO page).
