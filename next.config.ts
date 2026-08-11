import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    domains: ['example.com'], // Замените на реальные домены ваших изображений
  },
  // Больше никакого output: 'export'!
};

export default nextConfig;
