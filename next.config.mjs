/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: '*.ipfs.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'xprmint-metadata-oych.vercel.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.xprmint.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.gateway.pinata.cloud',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { webpack }) => {
    // Ignore optional wallet connector SDKs that we haven't installed.
    // This keeps wagmi happy without pulling in huge extra deps.
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(@base-org\/account|@coinbase\/wallet-sdk|@gemini-wallet\/core|@metamask\/sdk|porto|@safe-global\/safe-apps-sdk|@safe-global\/safe-apps-provider|@walletconnect\/ethereum-provider)(\/.*)?$/,
      })
    );
    return config;
  },
};

export default nextConfig;
