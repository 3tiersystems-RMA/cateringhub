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
    // Supabase uses guarded process.version checks; safe in middleware but noisy
    // in Next.js static analysis. Suppress only — do not DefinePlugin process.*
    // (that can break webpack module factories on Rocket / edge previews).
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /@supabase\/supabase-js/, message: /Edge Runtime/ },
      { module: /@supabase\/realtime-js/, message: /Edge Runtime/ },
    ];
    if (dev) {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: [/node_modules/],
        use: [{
          loader: '@dhiwise/component-tagger/nextLoader',
        }],
      });
    }
    return config;
  },
};

export default nextConfig;
