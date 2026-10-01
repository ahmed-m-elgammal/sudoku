import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // The duel server (assize-server) speaks REST + socket.io on :3030. In hosted
    // environments the sandbox gateway forwards via XTransformPort; these rewrites
    // make the same origin paths work in plain dev (localhost) too. socket.io's
    // polling handshake requires the exact trailing slash on /socket.io/.
    const duel = 'http://127.0.0.1:3030';
    return [
      { source: '/socket.io/', destination: `${duel}/socket.io/` },
      { source: '/socket.io', destination: `${duel}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${duel}/socket.io/:path*` },
      { source: '/api/auth', destination: `${duel}/api/auth` },
      { source: '/api/queue', destination: `${duel}/api/queue` },
      { source: '/api/friend/:path*', destination: `${duel}/api/friend/:path*` },
      { source: '/api/daily', destination: `${duel}/api/daily` },
      { source: '/api/daily/:path*', destination: `${duel}/api/daily/:path*` },
      { source: '/api/recovery', destination: `${duel}/api/recovery` },
      { source: '/api/purchases', destination: `${duel}/api/purchases` },
      { source: '/api/telemetry', destination: `${duel}/api/telemetry` },
      { source: '/api/health', destination: `${duel}/api/health` },
    ];
  },
};

export default nextConfig;
