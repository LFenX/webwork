import "server-only"

// Curated color palettes. Each provides three tones (accent / dark / soft) that
// templates use for headings, rules, boxes and covers. Colors are HEX without #.
export type LatexPalette = {
  id: string
  name: string
  accent: string
  accentDark: string
  accentSoft: string
}

export const LATEX_PALETTES: LatexPalette[] = [
  { id: "royal", name: "宝蓝 Royal", accent: "1F4E79", accentDark: "143657", accentSoft: "EAF1F8" },
  { id: "teal", name: "青 Teal", accent: "0F766E", accentDark: "0A524C", accentSoft: "E6F4F2" },
  { id: "emerald", name: "翠绿 Emerald", accent: "047857", accentDark: "045140", accentSoft: "E6F5EE" },
  { id: "indigo", name: "靛蓝 Indigo", accent: "4338CA", accentDark: "2E2589", accentSoft: "EEF0FE" },
  { id: "violet", name: "紫罗兰 Violet", accent: "7C3AED", accentDark: "5B23B6", accentSoft: "F2ECFE" },
  { id: "crimson", name: "绯红 Crimson", accent: "B91C1C", accentDark: "8A1414", accentSoft: "FDECEC" },
  { id: "amber", name: "琥珀金 Amber", accent: "B45309", accentDark: "843D07", accentSoft: "FBF0DD" },
  { id: "rose", name: "玫红 Rose", accent: "BE185D", accentDark: "8E1247", accentSoft: "FCE8F0" },
  { id: "ocean", name: "海蓝 Ocean", accent: "0369A1", accentDark: "024B73", accentSoft: "E4F2FA" },
  { id: "graphite", name: "石墨灰 Graphite", accent: "334155", accentDark: "1E293B", accentSoft: "EEF1F5" },
]

export const LATEX_PALETTE_IDS = LATEX_PALETTES.map((palette) => palette.id)
export const DEFAULT_PALETTE = "royal"

export function getPalette(id: string | undefined): LatexPalette {
  return LATEX_PALETTES.find((palette) => palette.id === id) ?? LATEX_PALETTES[0]
}
