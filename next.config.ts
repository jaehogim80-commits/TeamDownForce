import type { NextConfig } from 'next'
const nextConfig: NextConfig = {
  // 브랜드 이미지(힉스필드 생성물) — Vercel 이미지 최적화로 기기 크기에 맞춰 webp로 내려보낸다
  images: { remotePatterns: [{ protocol: 'https', hostname: 'd8j0ntlcm91z4.cloudfront.net' }] },
}
export default nextConfig
