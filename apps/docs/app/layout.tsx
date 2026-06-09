import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import HeaderNav from './_components/HeaderNav';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const SITE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'skope: news that reaches you',
  description:
    'Local-first personalized news intelligence. A lens + watcher on the world: Claude scans, skope keeps only what has a path to you (Reachability), and warns you against your own bubble. MCP · SQLite · no API key.',
  icons: {
    icon: [
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
    shortcut: '/favicon.ico',
  },
  openGraph: {
    title: 'skope: the news that reaches you',
    description:
      'Stop hunting the news. Claude scans the world, skope keeps only what reaches you, and watches you against your own bubble. Local-first, MCP, no API key.',
    url: 'https://github.com/evan-moon/skope',
    siteName: 'skope',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'skope: news that reaches you' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'skope: the news that reaches you',
    description: 'A local-first news lens + watcher. Claude MCP · SQLite · no API key.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      style={{ colorScheme: 'dark' }}
    >
      <body>
        <HeaderNav />
        {children}
      </body>
    </html>
  );
}
