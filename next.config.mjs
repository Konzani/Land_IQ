const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.resolve.fallback = { 
      fs: false, 
      path: false, 
      crypto: false 
    };
    return config;
  },
};

export default nextConfig;
