'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/app/_components/LocaleContext';
import type { Locale } from '@/app/_components/locale';

const DOCS_ROUTES: { slug: string; localized: Locale[]; group: string }[] = [
  { slug: 'getting-started', group: 'Get Started', localized: ['en', 'ko'] },
  { slug: 'mcp-tools',       group: 'Get Started', localized: ['en', 'ko'] },
  { slug: 'reachability',    group: 'Concepts',    localized: ['en', 'ko'] },
  { slug: 'concentration',   group: 'Concepts',    localized: ['en', 'ko'] },
  { slug: 'federation',      group: 'Concepts',    localized: ['en', 'ko'] },
  { slug: 'cli',             group: 'Reference',   localized: ['en', 'ko'] },
  { slug: 'ecosystem',       group: 'Ecosystem',   localized: ['en', 'ko'] },
];

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    'Get Started': 'Get Started',
    'Concepts':    'Concepts',
    'Reference':   'Reference',
    'getting-started': 'Installation',
    'mcp-tools':       'MCP Tools',
    'reachability':    'Reachability',
    'concentration':   'Concentration',
    'federation':      'Federation',
    'cli':             'CLI Reference',
    'Ecosystem':       'Ecosystem',
    'ecosystem':       'The Herald Family',
  },
  ko: {
    'Get Started': 'Get Started',
    'Concepts':    'Concepts',
    'Reference':   'Reference',
    'getting-started': '설치 및 시작',
    'mcp-tools':       'MCP 툴',
    'reachability':    'Reachability',
    'concentration':   '집중도 워처',
    'federation':      '페더레이션',
    'cli':             'CLI 레퍼런스',
    'Ecosystem':       'Ecosystem',
    'ecosystem':       'Herald 패밀리',
  },
};

export default function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const locale = useLocale();
  const pathname = usePathname() ?? '';
  const labels = LABELS[locale];

  const groups = DOCS_ROUTES.reduce<Map<string, typeof DOCS_ROUTES>>((acc, route) => {
    const list = acc.get(route.group) ?? [];
    list.push(route);
    acc.set(route.group, list);
    return acc;
  }, new Map());

  return (
    <nav className="docs-sidebar">
      {[...groups.entries()].map(([groupLabel, routes]) => (
        <div key={groupLabel} className="docs-nav-group">
          <p className="docs-nav-title">{labels[groupLabel] ?? groupLabel}</p>
          {routes.map(({ slug, localized }) => {
            const href = `/${locale}/docs/${slug}`;
            const translated = localized.includes(locale);
            return (
              <Link
                key={slug}
                href={href}
                className={`docs-nav-link${pathname === href ? ' active' : ''}`}
                onClick={onNavigate}
              >
                {labels[slug] ?? slug}
                {!translated && <span className="docs-nav-en-tag">EN</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
