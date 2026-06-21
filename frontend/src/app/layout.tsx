import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'AutoYield — AI DeFi Treasury on Sui',
  description:
    'Autonomous yield optimization across Scallop, DeepBook & Cetus. Set it and forget it.',
  openGraph: {
    title: 'AutoYield — AI DeFi Treasury on Sui',
    description: 'AI-managed DeFi treasury on Sui. Sign in with Google. No wallet needed.',
    images: [{ url: '/og.png.svg', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AutoYield',
    description: 'Autonomous DeFi yield on Sui. Set it and forget it.',
    images: ['/og.png.svg'],
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
