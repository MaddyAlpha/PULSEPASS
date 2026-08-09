/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:4000', 'a2ff509905e047.lhr.life'],
    },
  },
  allowedDevOrigins: ['a2ff509905e047.lhr.life', 'localhost', '192.168.43.95'],
}

module.exports = nextConfig
