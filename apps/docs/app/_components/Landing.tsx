import type { ReactNode } from 'react';
import type { Locale } from './locale';

type RadarCard = {
  title: string;
  axis: string;
  color: string;
  source: string;
  tier: string;
  path: string[];
};

type Copy = {
  headline: ReactNode;
  hook: string;
  sub: ReactNode;
  cta: string;
  ask1: string;
  tool: string;
  briefTitle: string;
  briefLoc: string;
  radarLabel: string;
  radar: RadarCard[];
  worldLabel: string;
  world: [string, string];
  concWarn: string;
  concNote: ReactNode;
  ask2: string;
  chain: string[];
  chainNote: ReactNode;
  feats: { mark: string; title: string; body: ReactNode }[];
  family: ReactNode;
  footer: string;
};

const db = <code className="hero-db"> ~/.skope/skope.db</code>;

const COPY: Record<Locale, Copy> = {
  en: {
    headline: (
      <>
        Your feed shows you everything.
        <br />
        skope shows you what reaches <em>you</em>.
      </>
    ),
    hook: 'Just ask Claude.',
    sub: (
      <>
        Stop hunting the news. Claude scans the world, skope keeps only what has a causal path to
        your life (your money, your work, your country) and watches you against your own bubble.
        Local-first. No account. No API key.
      </>
    ),
    cta: 'View on GitHub ↗',
    ask1: 'Catch me up on today’s news.',
    tool: 'skope connected · skimmed ~40 headlines, 9 reached you ›',
    briefTitle: 'TODAY’S BRIEF',
    briefLoc: '◎ Seoul, Korea',
    radarLabel: 'YOUR RADAR',
    radar: [
      {
        title: 'Tesla Q3 deliveries beat estimates, TSLA +6%',
        axis: 'asset',
        color: '#38bdf8',
        source: 'Reuters',
        tier: 'T1',
        path: ['Tesla', 'your holdings'],
      },
      {
        title: 'Toss parent Viva Republica eyes 2026 US IPO',
        axis: 'career',
        color: '#fbbf24',
        source: 'Yonhap',
        tier: 'T2',
        path: ['Toss', 'your employer'],
      },
      {
        title: 'React 19 ships with the new compiler',
        axis: 'knowledge',
        color: '#a78bfa',
        source: 'The Verge',
        tier: 'T3',
        path: ['React', 'your stack'],
      },
    ],
    worldLabel: 'THE WORLD',
    world: ['Bank of Korea holds rates', 'UN climate summit opens'],
    concWarn: '⚠ Attention check',
    concNote: (
      <>
        71% of this week sat on your <strong>asset</strong> axis. Want a cold-divergence pick to
        widen the lens?
      </>
    ),
    ask2: 'Why does a Brazil rate hike matter to me?',
    chain: ['Brazil rate hike', 'EM outflows', 'dollar strength', 'TSLA valuation', 'you'],
    chainNote: (
      <>
        Three steps, every one of them to you. A &ldquo;Rio street festival&rdquo; headline? Zero
        path, you&apos;ll never see it.
      </>
    ),
    feats: [
      {
        mark: '◎',
        title: 'A lens, not a filter',
        body: (
          <>
            Relevance is <em>Reachability</em> (does a causal path reach you?) not keyword
            matching. Broadened without being flooded.
          </>
        ),
      },
      {
        mark: '⚠',
        title: 'A watcher, not a feed',
        body: (
          <>
            The same concentration math a portfolio uses, on your attention. skope warns you when
            your reading collapses onto one axis.
          </>
        ),
      },
      {
        mark: '⌨',
        title: 'No key, no cloud',
        body: (
          <>
            Claude searches with the tools it already has. Your profile and history live in
            {db}. Only a query ever leaves.
          </>
        ),
      },
    ],
    family: (
      <>
        Part of the <strong>Herald</strong> family, {' '}
        <a href="https://github.com/evan-moon/firma">firma</a> (your money),{' '}
        <a href="https://github.com/evan-moon/memex">memex</a> (your memory), and skope (your news).
        One principle: your data stays on your machine, and the AI comes to it.
      </>
    ),
    footer: 'MIT License · © Evan Moon',
  },
  ko: {
    headline: (
      <>
        당신의 피드는 모든 걸 보여줍니다.
        <br />
        skope는 <em>당신</em>에게 닿는 것만 보여줍니다.
      </>
    ),
    hook: 'Claude에게 물어보기만 하세요.',
    sub: (
      <>
        뉴스를 사냥하지 마세요. Claude가 세상을 훑고, skope는 당신의 삶 (돈, 일, 나라) 으로
        이어지는 인과 경로가 있는 것만 남깁니다. 그리고 당신을 당신의 거품으로부터 지켜봅니다.
        로컬 우선. 계정 없음. API 키 없음.
      </>
    ),
    cta: 'GitHub에서 보기 ↗',
    ask1: '오늘 뉴스 좀 정리해 주세요.',
    tool: 'skope 연결됨 · 헤드라인 ~40개 훑음, 9개가 당신에게 닿음 ›',
    briefTitle: '오늘의 브리프',
    briefLoc: '◎ 서울, 대한민국',
    radarLabel: '당신의 레이더',
    radar: [
      {
        title: '테슬라 3분기 인도량 예상 상회, TSLA +6%',
        axis: 'asset',
        color: '#38bdf8',
        source: 'Reuters',
        tier: 'T1',
        path: ['테슬라', '내 보유 종목'],
      },
      {
        title: '토스 운영사 비바리퍼블리카, 2026 미국 IPO 검토',
        axis: 'career',
        color: '#fbbf24',
        source: '연합뉴스',
        tier: 'T2',
        path: ['토스', '내 회사'],
      },
      {
        title: 'React 19, 새 컴파일러와 함께 출시',
        axis: 'knowledge',
        color: '#a78bfa',
        source: 'The Verge',
        tier: 'T3',
        path: ['React', '내 스택'],
      },
    ],
    worldLabel: '세계',
    world: ['한국은행 금리 동결', 'UN 기후 정상회의 개막'],
    concWarn: '⚠ 주의 점검',
    concNote: (
      <>
        이번 주의 71%가 당신의 <strong>asset</strong> 축에 몰렸습니다. 렌즈를 넓힐
        콜드-다이버전스 추천을 받아볼까요?
      </>
    ),
    ask2: '브라질 금리 인상이 저와 무슨 상관인가요?',
    chain: ['브라질 금리 인상', '신흥국 자금 유출', '달러 강세', 'TSLA 밸류에이션', '당신'],
    chainNote: (
      <>
        세 단계, 그 모든 단계가 당신으로 향합니다. &ldquo;리우 거리 축제&rdquo; 헤드라인? 경로 없음
, 절대 보이지 않습니다.
      </>
    ),
    feats: [
      {
        mark: '◎',
        title: '필터가 아니라 렌즈',
        body: (
          <>
            관련성은 <em>Reachability</em>입니다 (인과 경로가 당신에게 닿는가?) 키워드 매칭이
            아니라. 넓히되 범람하지 않습니다.
          </>
        ),
      },
      {
        mark: '⚠',
        title: '피드가 아니라 워처',
        body: (
          <>
            포트폴리오가 쓰는 바로 그 집중도 수학을 당신의 주의에. 읽기가 한 축으로 무너지면
            skope가 경고합니다.
          </>
        ),
      },
      {
        mark: '⌨',
        title: '키도, 클라우드도 없이',
        body: (
          <>
            Claude는 이미 가진 도구로 검색합니다. 당신의 프로필과 기록은
            {db}에 저장됩니다. 밖으로 나가는 것은 쿼리뿐입니다.
          </>
        ),
      },
    ],
    family: (
      <>
        <strong>Herald</strong> 패밀리의 일원, {' '}
        <a href="https://github.com/evan-moon/firma">firma</a> (당신의 돈),{' '}
        <a href="https://github.com/evan-moon/memex">memex</a> (당신의 기억), 그리고 skope (당신의
        뉴스). 하나의 원칙: 데이터는 당신의 기기에 남고, AI가 그곳으로 옵니다.
      </>
    ),
    footer: 'MIT 라이선스 · © Evan Moon',
  },
};

export default function Landing({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  return (
    <main className="page">
      <section className="hero">
        <span className="logo">◎ skope</span>
        <h1 className="hero-headline">{c.headline}</h1>
        <p className="hero-hook">{c.hook}</p>
        <p className="hero-sub">{c.sub}</p>
        <div className="hero-actions">
          <code className="install">npm install -g @evan-moon/skope</code>
          <a href="https://github.com/evan-moon/skope" className="hero-cta">
            {c.cta}
          </a>
        </div>

        <div className="hero-viz">
          <div className="claude-ui">
            <div className="claude-chrome">
              <span className="claude-dot" style={{ background: '#ff5f57' }} />
              <span className="claude-dot" style={{ background: '#ffbd2e' }} />
              <span className="claude-dot" style={{ background: '#28ca41' }} />
              <span className="claude-chrome-title">Claude</span>
            </div>
            <div className="claude-body">
              <div className="claude-user-row" style={{ animation: 'card-in 0.3s ease 0.1s both' }}>
                <div className="claude-user-bubble">{c.ask1}</div>
              </div>

              <div
                className="claude-tool-indicator"
                style={{ animation: 'card-in 0.3s ease 0.4s both' }}
              >
                <span className="claude-tool-dot" />
                {c.tool}
              </div>

              <div className="claude-artifact" style={{ animation: 'card-in 0.4s ease 0.6s both' }}>
                <div className="brief-head">
                  <span className="brief-title">{c.briefTitle}</span>
                  <span className="brief-loc">{c.briefLoc}</span>
                </div>

                <p className="brief-section">{c.radarLabel}</p>
                <div className="radar">
                  {c.radar.map((r) => (
                    <div key={r.axis} className="radar-card">
                      <div className="radar-top">
                        <span className="radar-axis" style={{ color: r.color, borderColor: r.color }}>
                          {r.axis}
                        </span>
                        <span className="radar-src">
                          {r.source} <span className="radar-tier">{r.tier}</span>
                        </span>
                      </div>
                      <p className="radar-title">{r.title}</p>
                      <p className="radar-path">
                        {r.path.map((p, i) => (
                          <span key={p}>
                            {i > 0 && <span className="radar-arrow"> → </span>}
                            <span className={i === r.path.length - 1 ? 'radar-you' : ''}>{p}</span>
                          </span>
                        ))}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="brief-section">{c.worldLabel}</p>
                <div className="world">
                  <span className="world-item">{c.world[0]}</span>
                  <span className="world-dot">·</span>
                  <span className="world-item">{c.world[1]}</span>
                </div>

                <div className="conc">
                  <div className="conc-head">
                    <span className="conc-warn">{c.concWarn}</span>
                    <span className="conc-n">effective N = 1.4</span>
                  </div>
                  <div className="conc-bar">
                    <div className="conc-fill" style={{ width: '71%' }} />
                  </div>
                  <p className="conc-note">{c.concNote}</p>
                </div>
              </div>

              <div className="claude-thread-divider" />

              <div className="claude-user-row" style={{ animation: 'card-in 0.3s ease 0.9s both' }}>
                <div className="claude-user-bubble">{c.ask2}</div>
              </div>
              <div className="claude-ai-row" style={{ animation: 'card-in 0.3s ease 1.1s both' }}>
                <div className="claude-ai-text">
                  <div className="chain">
                    {c.chain.map((seg, i) => (
                      <span key={seg} className="chain-seg">
                        {i > 0 && <span className="chain-arrow">→</span>}
                        <span className={i === c.chain.length - 1 ? 'chain-you' : 'chain-node'}>
                          {seg}
                        </span>
                      </span>
                    ))}
                  </div>
                  {c.chainNote}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="feats">
        {c.feats.map((f) => (
          <div key={f.title} className="feat">
            <span className="feat-mark">{f.mark}</span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </section>

      <section className="family">
        <p>{c.family}</p>
      </section>

      <footer className="footer">
        <span>{c.footer}</span>
      </footer>
    </main>
  );
}
