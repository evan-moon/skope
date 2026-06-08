import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'skope — news that reaches you',
  description:
    'Local-first personalized news intelligence. A lens + watcher on the world: Claude scans, skope keeps only what has a path to you (Reachability), and warns you against your own bubble. MCP · SQLite · no API key.',
  openGraph: {
    title: 'skope: the news that reaches you',
    description:
      'Stop hunting the news. Claude scans the world, skope keeps only what reaches you — and watches you against your own bubble. Local-first, MCP, no API key.',
    url: 'https://github.com/evan-moon/skope',
    siteName: 'skope',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'skope: the news that reaches you',
    description: 'A local-first news lens + watcher. Claude MCP · SQLite · no API key.',
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
        <nav className="nav">
          <a href="/" className="nav-logo">
            <span className="nav-logo-mark">◎</span> skope
          </a>
          <div className="nav-links">
            <a className="nav-link" href="/en/docs/getting-started">
              Docs
            </a>
            <a className="nav-link" href="https://github.com/evan-moon/firma">
              firma
            </a>
            <a className="nav-link" href="https://github.com/evan-moon/memex">
              memex
            </a>
            <a className="nav-link" href="https://github.com/evan-moon/skope">
              GitHub <span className="nav-arrow">↗</span>
            </a>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
