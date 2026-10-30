import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Страницы, открытые в последние 30 секунд, показываются из памяти телефона мгновенно (переходы по нижнему меню).
    // После действий (запись, оплата) страницы обновляются через router.refresh().
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
