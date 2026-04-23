import type { MetadataRoute } from 'next';

import { getAllPostSlugs } from '@/lib/blog';
import {
  COMPETITORS,
  DEPARTMENTS,
  INTEGRATIONS,
  SITE_CONFIG,
  USE_CASES,
} from '@/lib/site-config';

/**
 * Auto-generated sitemap. Reads from `site-config.ts` registries +
 * `lib/blog.ts` so every programmatic-SEO page and every blog post is
 * automatically included. Add a slug to the registry and the sitemap
 * updates on next build — no sitemap edits required.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_CONFIG.url;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/features`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/help`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/integrations`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const competitorRoutes: MetadataRoute.Sitemap = COMPETITORS.map((c) => ({
    url: `${base}/compare/${c.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const useCaseRoutes: MetadataRoute.Sitemap = USE_CASES.map((u) => ({
    url: `${base}/use-cases/${u.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const departmentRoutes: MetadataRoute.Sitemap = DEPARTMENTS.map((d) => ({
    url: `${base}/crm-for/${d.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const integrationRoutes: MetadataRoute.Sitemap = INTEGRATIONS.map((i) => ({
    url: `${base}/integrations/${i.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  const postSlugs = await getAllPostSlugs();
  const blogRoutes: MetadataRoute.Sitemap = postSlugs.map((slug) => ({
    url: `${base}/blog/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [
    ...staticRoutes,
    ...competitorRoutes,
    ...useCaseRoutes,
    ...departmentRoutes,
    ...integrationRoutes,
    ...blogRoutes,
  ];
}
