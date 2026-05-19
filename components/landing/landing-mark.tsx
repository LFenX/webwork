export function SpaceMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ flexShrink: 0 }} aria-hidden>
      <rect x="3" y="3" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
      <rect x="13.5" y="13.5" width="5" height="5" rx="0.5" fill="var(--accent)" />
    </svg>
  )
}

export function BigSpaceMark() {
  return (
    <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden>
      <defs>
        <radialGradient id="landing-bg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="110" fill="url(#landing-bg-glow)" />
      <rect x="20" y="20" width="180" height="180" rx="10" fill="none" stroke="var(--line-strong)" strokeWidth="1" />
      <rect x="20" y="20" width="180" height="180" rx="10" fill="none" stroke="var(--accent)" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 5" />
      <rect x="48" y="48" width="124" height="124" rx="6" fill="none" stroke="var(--accent)" strokeWidth="1" />
      <path d="M48 110 H172 M110 48 V172" stroke="var(--accent)" strokeWidth="0.8" strokeOpacity="0.35" />
      <rect x="86" y="86" width="48" height="48" rx="3" fill="var(--accent)" fillOpacity="0.9" />
      <rect x="100" y="100" width="20" height="20" rx="1" fill="var(--bg-deep)" />
      {[[20, 20], [200, 20], [20, 200], [200, 200]].map(([x, y], i) => (
        <rect key={i} x={x - 2} y={y - 2} width="4" height="4" fill="var(--text-3)" />
      ))}
      <text x="110" y="218" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--text-3)" letterSpacing="3">
        MY · SPACE · 2026
      </text>
    </svg>
  )
}

export function FooterSpaceMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
      <rect x="3" y="3" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="14" height="14" rx="2" fill="none" stroke="var(--accent)" strokeWidth="1.4" />
      <rect x="13.5" y="13.5" width="5" height="5" rx="0.5" fill="var(--accent)" />
    </svg>
  )
}
