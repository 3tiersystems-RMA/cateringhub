import { imageHosts } from './image-hosts.config.mjs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// The @dhiwise/component-tagger dev loader does `require('chalk')`. chalk v5+ is
// ESM-only and throws ERR_REQUIRE_ESM under require(), which crashes dev compilation.
// Probe it once so we can register the loader only when it can actually load.
function componentTaggerIsSafe() {
  try {
    require('chalk');
    return true;
  } catch {
    return false;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // cache-bust: 2026-06-03
  productionBrowserSourceMaps: true,
  distDir: '.next',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: imageHosts,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/homepage',
        permanent: false,
      },
      {
        source: '/recipes',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/about-us',
        destination: '/homepage',
        permanent: true,
      },
      {
        source: '/contact-us',
        destination: '/contact',
        permanent: true,
      },
      {
        source: '/dish-a',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/dish-b',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/dish-c',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/dish-d',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/order-menu',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/privacy-policy',
        destination: '/privacy',
        permanent: true,
      },
      {
        source: '/terms-and-conditions-of-purchases',
        destination: '/homepage',
        permanent: true,
      },
      {
        source: '/terms-and-conditions-of-purchase',
        destination: '/homepage',
        permanent: true,
      },
      {
        source: '/fadwah',
        destination: '/products',
        permanent: true,
      },
      {
        source: '/pod',
        destination: '/products',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/assets/images/app_logo.png',
        destination: '/assets/images/Favicon-1778145940787.jpg',
      },
    ];
  },
  webpack(config, { dev: dev }) {
    // The component-tagger is a development-only visual-editor tool. Its
    // nextLoader.js does require('chalk'), and chalk v5+ is ESM-only, which
    // breaks the build (ERR_REQUIRE_ESM). Apply it only in dev AND only when
    // chalk can be required, so an incompatible chalk can't crash compilation.
    if (dev && componentTaggerIsSafe()) {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: [/node_modules/],
        use: [
          {
            loader: '@dhiwise/component-tagger/nextLoader',
          },
        ],
      });
    }
    if (dev) {
      const ignoredPaths = (process.env.WATCH_IGNORED_PATHS || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      config.watchOptions = {
        ignored: ignoredPaths.length
          ? ignoredPaths.map((p) => `**/${p.replace(/^\/+|\/+$/g, '')}/**`)
          : undefined,
      };
    }
    return config;
  },
};

export default nextConfig;
