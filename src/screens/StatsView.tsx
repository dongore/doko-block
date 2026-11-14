import { useEffect, useMemo, useRef, useState } from 'react';
import { PlayerDot } from '../components/ui';
import { plain, signed } from '../logic/format';
import { ranking, type SessionView } from '../logic/session';
import { highlights, playerStats } from '../logic/stats';
import type { Session } from '../state/types';

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function ScoreChart({ session, view }: { session: Session; view: SessionView }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const players = session.players;
  const n = view.games.length;
  const series = useMemo(() => players.map((p) => [0, ...view.games.map((g) => g.totals[p.id] ?? 0)]), [players, view.games]);
  const all = series.flat();
  const step = niceStep(Math.max(1, (Math.max(...all, 0) - Math.min(...all, 0)) / 4));
  const yMax = Math.ceil(Math.max(...all, 1) / step) * step;
  const yMin = Math.floor(Math.min(...all, -1) / step) * step;
  const directLabels = players.length <= 4;

  const H = 260;
  const pad = { l: 40, r: directLabels ? 72 : 14, t: 14, b: 28 };
  const iw = width - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (n === 0 ? 0 : (i / n) * iw);
  const y = (v: number) => pad.t + ((yMax - v) / (yMax - yMin)) * ih;
  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(v);
  const xStep = niceStep(Math.max(1, n / Math.max(2, Math.floor(iw / 56))));
  const xTicks: number[] = [];
  for (let i = 0; i <= n; i += xStep) xTicks.push(i);

  // Direct labels at the line ends, nudged apart so they never overlap.
  const ends = players
    .map((p, k) => ({ k, name: p.name, v: series[k][n], y: y(series[k][n]) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const rel = (e.clientX - r.left) / r.width;
    setHover(Math.max(0, Math.min(n, Math.round(rel * n))));
  };

  const tipRows = hover == null ? [] : players.map((p, k) => ({ p, k, v: series[k][hover] })).sort((a, b) => b.v - a.v);
  const tipLeft = hover == null ? 0 : x(hover);

  return (
    <div className="chart" ref={wrap}>
      <svg width={width} height={H} role="img" aria-label="Punkteverlauf aller Spieler über die Spiele">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} className={v === 0 ? 'chart__zero' : 'chart__grid'} />
            <text x={pad.l - 8} y={y(v)} className="chart__tick" textAnchor="end" dominantBaseline="middle">
              {plain(v)}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={H - 8} className="chart__tick" textAnchor="middle">
            {i}
          </text>
        ))}
        {series.map((pts, k) => (
          <polyline
            key={players[k].id}
            points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={`var(--p${(k % 7) + 1})`}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {series.map((pts, k) => (
          <circle key={k} cx={x(n)} cy={y(pts[n])} r={4} fill={`var(--p${(k % 7) + 1})`} stroke="var(--paper)" strokeWidth={2} />
        ))}
        {directLabels &&
          ends.map((e) => (
            <text key={e.k} x={pad.l + iw + 10} y={e.y} className="chart__label" dominantBaseline="middle">
              {e.name} <tspan className="chart__label-val">{plain(e.v)}</tspan>
            </text>
          ))}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="chart__cross" />
            {series.map((pts, k) => (
              <circle key={k} cx={x(hover)} cy={y(pts[hover])} r={4.5} fill={`var(--p${(k % 7) + 1})`} stroke="var(--paper)" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect
          x={pad.l}
          y={0}
          width={Math.max(1, iw)}
          height={H}
          fill="transparent"
          style={{ touchAction: 'pan-y' }}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover != null && (
        <div className={`chart__tip${tipLeft > width / 2 ? ' is-left' : ''}`} style={{ left: tipLeft }} role="status">
          <div className="chart__tip-title">{hover === 0 ? 'Start' : `Nach Spiel ${hover}`}</div>
          {tipRows.map((r) => (
            <div key={r.p.id} className="chart__tip-row">
              <span className="chart__key" style={{ background: `var(--p${(r.k % 7) + 1})` }} />
              <strong className="num">{plain(r.v)}</strong>
              <span>{r.p.name}</span>
            </div>
          ))}
        </div>
      )}
      <ul className="legend">
        {players.map((p, k) => (
          <li key={p.id}>
            <span className="legend__line" style={{ background: `var(--p${(k % 7) + 1})` }} />
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '–');

export function StatsView({ session, view }: { session: Session; view: SessionView }) {
  if (view.games.length === 0) {
    return (
      <div className="page empty">
        <p className="empty__title">Noch keine Statistik</p>
        <p className="muted">Nach dem ersten eingetragenen Spiel siehst du hier den Verlauf und die Bilanz jedes Spielers.</p>
      </div>
    );
  }
  const stats = playerStats(session, view);
  const ranks = ranking(session.players, view.totals);
  const hl = highlights(view);
  const byId = Object.fromEntries(stats.map((s) => [s.id, s]));
  const nameOf = (id: string) => session.players.find((p) => p.id === id)?.name ?? '';
  const mostWins = [...stats].sort((a, b) => b.won - a.won)[0];

  return (
    <div className="page stats">
      <section className="card">
        <h2 className="card__title">Punkteverlauf</h2>
        <ScoreChart session={session} view={view} />
      </section>

      <section className="tiles">
        <div className="tile">
          <span className="tile__label">Höchstes Spiel</span>
          <span className="tile__value num">±{hl.biggestGame?.value ?? 0}</span>
          <span className="tile__note">Spiel {hl.biggestGame?.number}</span>
        </div>
        <div className="tile">
          <span className="tile__label">Re : Kontra</span>
          <span className="tile__value num">
            {hl.reWins} : {hl.kontraWins}
          </span>
          <span className="tile__note">gewonnene Normalspiele</span>
        </div>
        <div className="tile">
          <span className="tile__label">Bock-Spiele</span>
          <span className="tile__value num">{hl.bockGames}</span>
          <span className="tile__note">von {view.games.length} Spielen</span>
        </div>
        <div className="tile">
          <span className="tile__label">Meiste Siege</span>
          <span className="tile__value num">{mostWins?.won ?? 0}</span>
          <span className="tile__note">{mostWins ? nameOf(mostWins.id) : '–'}</span>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Bilanz</h2>
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th scope="col" className="stats-table__name">
                  Spieler
                </th>
                <th scope="col">Punkte</th>
                <th scope="col">Spiele</th>
                <th scope="col">Siege</th>
                <th scope="col">Re</th>
                <th scope="col">Kontra</th>
                <th scope="col">Soli</th>
                <th scope="col">Ansagen</th>
                <th scope="col">Ø</th>
                <th scope="col">Bestes</th>
                <th scope="col">Schlechtestes</th>
              </tr>
            </thead>
            <tbody>
              {ranks.map(({ player, rank }) => {
                const s = byId[player.id];
                return (
                  <tr key={player.id}>
                    <th scope="row" className="stats-table__name">
                      <span className="stats-table__who">
                        <span className="stats-table__rank num">{rank}.</span>
                        <PlayerDot index={session.players.indexOf(player)} />
                        {player.name}
                      </span>
                    </th>
                    <td className={`num strong ${s.total < 0 ? 'is-neg' : ''}`}>{plain(s.total)}</td>
                    <td className="num">{s.played}</td>
                    <td className="num">{pct(s.won, s.played)}</td>
                    <td className="num">
                      {s.reWon}/{s.reGames}
                    </td>
                    <td className="num">
                      {s.kontraWon}/{s.kontraGames}
                    </td>
                    <td className="num">
                      {s.solosWon}/{s.solos}
                      {session.rules.pflichtsolo.enabled && (
                        <span className={`pflicht-mark${view.pflichtDone[player.id] ? ' is-done' : ''}`} title={view.pflichtDone[player.id] ? 'Pflichtsolo gespielt' : 'Pflichtsolo offen'}>
                          P
                        </span>
                      )}
                    </td>
                    <td className="num">{s.announcements}</td>
                    <td className="num">{s.played ? (s.total / s.played).toFixed(1).replace('.', ',').replace('-', '−') : '–'}</td>
                    <td className="num">{signed(s.best)}</td>
                    <td className="num">{signed(s.worst)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="section__hint">Re und Kontra zählen gewonnene / gespielte Normalspiele, Soli gewonnene / gespielte Soli.</p>
      </section>
    </div>
  );
}
