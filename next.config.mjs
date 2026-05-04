/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 클릭재킹 방지
          { key: 'X-Frame-Options', value: 'DENY' },
          // MIME 스니핑 방지
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer 정책
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // XSS 필터 (구형 브라우저)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // 불필요한 브라우저 권한 차단
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },
}

export default nextConfig
