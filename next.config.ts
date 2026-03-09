import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase + nodemailerはサーバー専用パッケージ
  serverExternalPackages: ['nodemailer'],
};

export default nextConfig;
