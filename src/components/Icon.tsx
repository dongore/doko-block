const PATHS: Record<string, string> = {
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevron: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  up: 'M6 15l6-6 6 6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  users: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-1a4 4 0 00-3-3.87M15.5 3.13a3.5 3.5 0 010 6.75',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  chart: 'M4 19h16M6 15l4-5 4 3 5-7',
  coins: 'M8 10c3.3 0 6-1.1 6-2.5S11.3 5 8 5 2 6.1 2 7.5 4.7 10 8 10zM2 7.5v4C2 12.9 4.7 14 8 14s6-1.1 6-2.5v-4M10 18.9c.6.1 1.3.1 2 .1 3.3 0 6-1.1 6-2.5v-4M14 10.6c2.3.3 4 1.2 4 2.4M18 12.5c2.3.3 4 1.2 4 2.4v4c0 1.4-2.7 2.5-6 2.5-1.6 0-3-.3-4.1-.7',
  block: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM5 8h14M5 13h14M10 8v13',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  play: 'M7 4l12 8-12 8V4z',
  copy: 'M9 9h10v10a2 2 0 01-2 2H9a2 2 0 01-2-2V11a2 2 0 012-2zM5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1',
  dice: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM8 8h.01M16 16h.01M12 12h.01M16 8h.01M8 16h.01',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
  cards: 'M8 3h10a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zM4 7v12a2 2 0 002 2h9',
  swap: 'M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4',
};

export function Icon({ name, size = 20, strokeWidth = 2 }: { name: keyof typeof PATHS | string; size?: number; strokeWidth?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

/** The app mark: two fanned cards, Herz behind Kreuz-Dame. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" className="logo">
      <rect width="512" height="512" rx="116" fill="#0e5a40" />
      <g transform="rotate(-13 256 300)">
        <rect x="132" y="104" width="214" height="296" rx="26" fill="#bfdccb" />
        <path d="M188 154c-14 0-24 10-24 22 0 18 24 30 24 44 0-14 24-26 24-44 0-12-10-22-24-22z" fill="#c1272d" />
      </g>
      <g transform="rotate(9 256 300)">
        <rect x="168" y="112" width="214" height="296" rx="26" fill="#fbfcfb" />
        <g fill="#14201b">
          <circle cx="275" cy="226" r="37" />
          <circle cx="236" cy="282" r="37" />
          <circle cx="314" cy="282" r="37" />
          <circle cx="275" cy="268" r="24" />
          <path d="M275 262 C279 312 290 340 302 352 L248 352 C260 340 271 312 275 262 Z" />
        </g>
        <path d="M200 132h14c16 0 26 10 26 24s-10 24-26 24h-14z" fill="none" stroke="#14201b" strokeWidth="9" />
      </g>
    </svg>
  );
}

/** Two fanned cards: marks who deals next. */
export function DealerIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="icon" width={size} height={Math.round(size * 0.85)} viewBox="0 0 20 17" aria-hidden="true">
      <rect x="3" y="2.5" width="8.5" height="12" rx="1.6" transform="rotate(-14 7.2 8.5)" fill="currentColor" opacity="0.45" />
      <rect x="8.5" y="2" width="8.5" height="12" rx="1.6" transform="rotate(10 12.7 8)" fill="currentColor" />
    </svg>
  );
}
