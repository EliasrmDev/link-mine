import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow images from Google (OAuth avatars)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  // Strict mode for better error detection
  reactStrictMode: true,
}

export default nextConfig
