import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // УБРАЛИ output: 'export' - это главная причина ошибок
  images: {
    unoptimized: true, // Оставляем для статического экспорта
    domains: ['example.com'], // Замените на реальные домены изображений
  },
  // Настройки для кэша (убирает предупреждение)
  cacheHandler: require.resolve('next/dist/server/lib/simple-cache-handler'),
  cacheMaxMemorySize: 0,
};

export default nextConfig;
