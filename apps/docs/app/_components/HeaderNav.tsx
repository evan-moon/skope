'use client';
import { usePathname } from 'next/navigation';
import LangToggle from './LangToggle';

export default function HeaderNav() {
  const pathname = usePathname() || '/';
  const onKo = pathname === '/ko' || pathname.startsWith('/ko/');
  const homeHref = onKo ? '/ko' : '/';
  const docsHref = onKo ? '/ko/docs/getting-started' : '/en/docs/getting-started';

  return (
    <nav className="nav">
      <a href={homeHref} className="nav-logo">
        <span className="nav-logo-mark">◎</span> skope
      </a>
      <div className="nav-links">
        <a className="nav-link" href={docsHref}>
          {onKo ? '문서' : 'Docs'}
        </a>
        <a className="nav-link" href="https://github.com/evan-moon/skope">
          GitHub <span className="nav-arrow">↗</span>
        </a>
        <LangToggle />
      </div>
    </nav>
  );
}
