'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import LangToggle from './LangToggle';

export default function HeaderNav() {
  const pathname = usePathname() || '/';
  const onKo = pathname === '/ko' || pathname.startsWith('/ko/');
  const homeHref = onKo ? '/ko' : '/';
  const docsHref = onKo ? '/ko/docs/getting-started' : '/en/docs/getting-started';
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('main-drawer-open', mobileOpen);
    return () => {
      document.body.classList.remove('main-drawer-open');
    };
  }, [mobileOpen]);

  return (
    <header className="nav">
      <button
        type="button"
        className={`nav-mobile-toggle${mobileOpen ? ' open' : ''}`}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span />
      </button>
      <a href={homeHref} className="nav-logo">
        <span className="nav-logo-mark">◎</span> skope
      </a>
      <button
        type="button"
        className={`nav-mobile-backdrop${mobileOpen ? ' open' : ''}`}
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />
      <nav className="nav-links">
        <a className="nav-link" href={docsHref}>
          {onKo ? '문서' : 'Docs'}
        </a>
        <a className="nav-link" href="https://github.com/evan-moon/skope">
          GitHub <span className="nav-arrow">↗</span>
        </a>
        <LangToggle />
      </nav>
      <nav className={`nav-mobile-menu${mobileOpen ? ' open' : ''}`}>
        <div className="nav-mobile-menu-links">
          <a className="nav-mobile-menu-link" href={homeHref}>
            {onKo ? '홈' : 'Home'}
          </a>
          <a className="nav-mobile-menu-link" href={docsHref}>
            {onKo ? '문서' : 'Docs'}
          </a>
          <a className="nav-mobile-menu-link" href="https://github.com/evan-moon/skope">
            GitHub
          </a>
        </div>
        <div className="nav-mobile-menu-lang">
          <LangToggle />
        </div>
      </nav>
    </header>
  );
}
