import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Marketing site: lean, fast, SSG-first.
  reactStrictMode: true,

  // `@phloz/*` packages ship TS source; Next needs to transpile them.
  transpilePackages: [
    '@phloz/analytics',
    '@phloz/billing',
    '@phloz/config',
    '@phloz/ui',
  ],

  // Strip console in production builds but keep error/warn for Sentry.
  compiler: {
    removeConsole: { exclude: ['error', 'warn'] },
  },

  // Images ship from Vercel CDN; allow inline SVG for logos/decoration.
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Redirects live here (e.g. legacy paths). Empty for now.
  async redirects() {
    return [];
  },

  // MDX is rendered via `next-mdx-remote/rsc` in-route, not via Next's
  // built-in loader, so no MDX page extension config needed.
  pageExtensions: ['ts', 'tsx'],
};

export default nextConfig;
