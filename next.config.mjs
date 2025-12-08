/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
