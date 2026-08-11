/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'out', // Папка для экспорта
  images: {
    unoptimized: true, // Обязательно для GitHub Pages
  },
  // Отключаем все лишнее
  reactStrictMode: false,
  swcMinify: true,
};

module.exports = nextConfig;
