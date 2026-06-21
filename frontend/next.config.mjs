/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['em-content.zobj.net', 'avatars.githubusercontent.com'],
  },
  env: {
    NEXT_PUBLIC_SUI_NETWORK: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
    NEXT_PUBLIC_VAULT_ID: process.env.NEXT_PUBLIC_VAULT_ID || '0x029c9ecb485714213476e98cee993f5afc6b32be0b6d10001144163f90bb962e',
    NEXT_PUBLIC_PACKAGE_ID: process.env.NEXT_PUBLIC_PACKAGE_ID || '0xf3ea5bf8ce40a063fb95b17fb4d28770033c2e3895c72826bc0e85cab7401228',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  },
  transpilePackages: [
    '@mysten/sui',
    '@mysten/dapp-kit',
    '@mysten/zklogin',
    '@mysten/wallet-standard',
  ],
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};

export default nextConfig;
