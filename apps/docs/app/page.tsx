const RADAR = [
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
] as const;

const CHAIN = ['Brazil rate hike', 'EM outflows', 'dollar strength', 'TSLA valuation', 'you'];

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <span className="logo">◎ skope</span>
        <h1 className="hero-headline">
          Your feed shows you everything.
          <br />
          skope shows you what reaches <em>you</em>.
        </h1>
        <p className="hero-hook">Just ask Claude.</p>
        <p className="hero-sub">
          Stop hunting the news. Claude scans the world, skope keeps only what has a causal path to
          your life — your money, your work, your country — and watches you against your own bubble.
          Local-first. No account. No API key.
        </p>
        <div className="hero-actions">
          <code className="install">npm install -g @evan-moon/skope</code>
          <a href="https://github.com/evan-moon/skope" className="hero-cta">
            View on GitHub ↗
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
                <div className="claude-user-bubble">Catch me up on today&apos;s news.</div>
              </div>

              <div
                className="claude-tool-indicator"
                style={{ animation: 'card-in 0.3s ease 0.4s both' }}
              >
                <span className="claude-tool-dot" />
                skope connected · skimmed ~40 headlines, 9 reached you ›
              </div>

              <div className="claude-artifact" style={{ animation: 'card-in 0.4s ease 0.6s both' }}>
                <div className="brief-head">
                  <span className="brief-title">TODAY&apos;S BRIEF</span>
                  <span className="brief-loc">◎ Seoul, Korea</span>
                </div>

                <p className="brief-section">YOUR RADAR</p>
                <div className="radar">
                  {RADAR.map((r) => (
                    <div key={r.title} className="radar-card">
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

                <p className="brief-section">THE WORLD</p>
                <div className="world">
                  <span className="world-item">Bank of Korea holds rates</span>
                  <span className="world-dot">·</span>
                  <span className="world-item">UN climate summit opens</span>
                </div>

                <div className="conc">
                  <div className="conc-head">
                    <span className="conc-warn">⚠ Attention check</span>
                    <span className="conc-n">effective N = 1.4</span>
                  </div>
                  <div className="conc-bar">
                    <div className="conc-fill" style={{ width: '71%' }} />
                  </div>
                  <p className="conc-note">
                    71% of this week sat on your <strong>asset</strong> axis. Want a
                    cold-divergence pick to widen the lens?
                  </p>
                </div>
              </div>

              <div className="claude-thread-divider" />

              <div className="claude-user-row" style={{ animation: 'card-in 0.3s ease 0.9s both' }}>
                <div className="claude-user-bubble">Why does a Brazil rate hike matter to me?</div>
              </div>
              <div className="claude-ai-row" style={{ animation: 'card-in 0.3s ease 1.1s both' }}>
                <div className="claude-ai-text">
                  <div className="chain">
                    {CHAIN.map((c, i) => (
                      <span key={c} className="chain-seg">
                        {i > 0 && <span className="chain-arrow">→</span>}
                        <span className={i === CHAIN.length - 1 ? 'chain-you' : 'chain-node'}>
                          {c}
                        </span>
                      </span>
                    ))}
                  </div>
                  Three steps, every one of them to you. A &ldquo;Rio street festival&rdquo;
                  headline? Zero path — you&apos;ll never see it.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="feats">
        <div className="feat">
          <span className="feat-mark">◎</span>
          <h3>A lens, not a filter</h3>
          <p>
            Relevance is <em>Reachability</em> — does a causal path reach you? — not keyword
            matching. Broadened without being flooded.
          </p>
        </div>
        <div className="feat">
          <span className="feat-mark">⚠</span>
          <h3>A watcher, not a feed</h3>
          <p>
            The same concentration math a portfolio uses, on your attention. skope warns you when
            your reading collapses onto one axis.
          </p>
        </div>
        <div className="feat">
          <span className="feat-mark">⌨</span>
          <h3>No key, no cloud</h3>
          <p>
            Claude searches with the tools it already has. Your profile and history live in
            <code> ~/.skope/skope.db</code>. Only a query ever leaves.
          </p>
        </div>
      </section>

      <section className="family">
        <p>
          Part of the <strong>Herald</strong> family —{' '}
          <a href="https://github.com/evan-moon/firma">firma</a> (your money),{' '}
          <a href="https://github.com/evan-moon/memex">memex</a> (your memory), and skope (your
          news). One principle: your data stays on your machine, and the AI comes to it.
        </p>
      </section>

      <footer className="footer">
        <span>MIT License · © Evan Moon</span>
      </footer>
    </main>
  );
}
