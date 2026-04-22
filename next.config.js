/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["nebula-lg.top", "*.nebula-lg.top"],
  experimental: {
    serverActions: {
      allowedOrigins: ["nebula-lg.top", "*.nebula-lg.top"],
    },
  },
}

module.exports = nextConfig
