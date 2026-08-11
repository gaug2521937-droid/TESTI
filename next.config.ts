import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // УДАЛИТЕ ЭТУ СТРОКУ (она мешает динамическому рендерингу):
  // output: 'export',

  images: {
    unoptimized: true,
    domains: ['example.com'], // Замените на реальные домены ваших изображений
  },

  // Дополнительные настройки для лучшей совместимости
  experimental: {
    serverActions: true,
  },
};

export default nextConfig;
