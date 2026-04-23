import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  transpilePackages: [
    '@phloz/analytics',
    '@phloz/auth',
    '@phloz/billing',
    '@phloz/config',
    '@phloz/db',
    '@phloz/email',
    '@phloz/tracking-map',
    '@phloz/types',
    '@phloz/ui',
  ],

  compiler: {
    removeConsole: { exclude: ['error', 'warn'] },
  },

  // Stripe SDK uses top-level-await; leave serverActions default.
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
