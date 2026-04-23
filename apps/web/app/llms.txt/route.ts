import { NextResponse } from 'next/server';

import { getAllPosts } from '@/lib/blog';
import {
  COMPETITORS,
  DEPARTMENTS,
  INTEGRATIONS,
  SITE_CONFIG,
  USE_CASES,
} from '@/lib/site-config';

export const dynamic = 'force-static';
export const revalidate = 3600;

/**
 * `/llms.txt` — a categorized, crawler-friendly index for LLMs.
 * Mirrors the sitemap but grouped by semantic section with short
 * descriptions, so retrievers can decide what to fetch without
 * scraping the HTML.
 *
 * Spec: https://llmstxt.org/
 */
export async function GET() {
  const lines: string[] = [];
  const push = (s: string = '') => lines.push(s);

  push(`# ${SITE_CONFIG.name}`);
  push('');
  push(`> ${SITE_CONFIG.tagline}`);
  push('');
  push(SITE_CONFIG.description);
  push('');

  push('## Core pages');
  push('');
  push(`- [Home](${SITE_CONFIG.url}/): What Phloz is and who it's for.`);
  push(`- [Features](${SITE_CONFIG.url}/features): Every module — CRM, work management, tracking map, messaging, reporting.`);
  push(`- [Pricing](${SITE_CONFIG.url}/pricing): Per-active-client pricing with six tiers.`);
  push(`- [About](${SITE_CONFIG.url}/about): Why Phloz exists.`);
  push(`- [Contact](${SITE_CONFIG.url}/contact): How to reach us.`);
  push(`- [Help](${SITE_CONFIG.url}/help): Getting-started guides and FAQ.`);
  push('');

  push('## Integrations');
  push('');
  for (const i of INTEGRATIONS) {
    push(`- [${i.name}](${SITE_CONFIG.url}/integrations/${i.slug}): ${i.category} integration.`);
  }
  push('');

  push('## Use cases');
  push('');
  for (const u of USE_CASES) {
    push(`- [${u.name}](${SITE_CONFIG.url}/use-cases/${u.slug})`);
  }
  push('');

  push('## CRM for [department]');
  push('');
  for (const d of DEPARTMENTS) {
    push(`- [${d.name} agencies](${SITE_CONFIG.url}/crm-for/${d.slug})`);
  }
  push('');

  push('## Compare Phloz to');
  push('');
  for (const c of COMPETITORS) {
    push(`- [vs ${c.name}](${SITE_CONFIG.url}/compare/${c.slug})`);
  }
  push('');

  const posts = await getAllPosts();
  if (posts.length > 0) {
    push('## Blog');
    push('');
    for (const p of posts) {
      push(`- [${p.title}](${SITE_CONFIG.url}/blog/${p.slug}): ${p.description}`);
    }
    push('');
  }

  push('## Legal');
  push('');
  push(`- [Terms](${SITE_CONFIG.url}/legal/terms)`);
  push(`- [Privacy](${SITE_CONFIG.url}/legal/privacy)`);
  push('');

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
