// ─────────────────────────────────────────────────────────────────────────────
// UI themes (style skins)
//
// Each theme overrides the design tokens used app-wide (see src/index.css :root):
// the accent palette + the glass recipe (--glass-bg / --glass-border /
// --glass-blur / --glass-shadow) + the app background. Because every panel uses
// the .glass class (which reads those vars), switching a theme reskins the whole
// dashboard live. 'default' reproduces the original look.
// ─────────────────────────────────────────────────────────────────────────────

export interface UiTheme {
  id: string
  name: string
  desc: string
  vars: {
    '--accent': string
    '--accent-2': string
    '--accent-glow': string
    '--grad-btn': string
    '--glass-bg': string
    '--glass-border': string
    '--glass-blur': string
    '--glass-shadow': string
    '--app-bg': string
  }
}

export const UI_THEMES: UiTheme[] = [
  {
    id: 'default',
    name: 'Aurora',
    desc: 'The classic deep-violet dashboard.',
    vars: {
      '--accent': 'oklch(0.62 0.22 280)',
      '--accent-2': 'oklch(0.55 0.24 295)',
      '--accent-glow': 'rgba(124,58,237,0.45)',
      '--grad-btn': 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))',
      '--glass-bg': 'linear-gradient(160deg, rgba(18,14,34,0.78), rgba(8,6,20,0.82))',
      '--glass-border': 'rgba(255,255,255,0.12)',
      '--glass-blur': 'blur(28px) saturate(160%)',
      '--glass-shadow': 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 70px -28px rgba(8,6,20,0.85), 0 10px 30px -15px rgba(124,58,237,0.45)',
      '--app-bg': 'oklch(0.13 0.01 260)',
    },
  },
  {
    id: 'frosted',
    name: 'Frosted Glass',
    desc: 'Bright translucent panels + heavy blur — full glassmorphism.',
    vars: {
      '--accent': 'oklch(0.70 0.15 255)',
      '--accent-2': 'oklch(0.64 0.16 240)',
      '--accent-glow': 'rgba(125,160,255,0.45)',
      '--grad-btn': 'linear-gradient(135deg, oklch(0.70 0.15 255), oklch(0.64 0.16 240))',
      '--glass-bg': 'linear-gradient(160deg, rgba(255,255,255,0.13), rgba(255,255,255,0.05))',
      '--glass-border': 'rgba(255,255,255,0.30)',
      '--glass-blur': 'blur(44px) saturate(185%)',
      '--glass-shadow': 'inset 0 1px 0 rgba(255,255,255,0.28), 0 24px 70px -24px rgba(0,0,0,0.55)',
      '--app-bg': 'oklch(0.17 0.04 265)',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Glass',
    desc: 'Cool cyan frost over deep blue.',
    vars: {
      '--accent': 'oklch(0.72 0.13 205)',
      '--accent-2': 'oklch(0.64 0.14 220)',
      '--accent-glow': 'rgba(34,211,238,0.42)',
      '--grad-btn': 'linear-gradient(135deg, oklch(0.72 0.13 205), oklch(0.64 0.14 220))',
      '--glass-bg': 'linear-gradient(160deg, rgba(18,40,56,0.55), rgba(8,22,36,0.70))',
      '--glass-border': 'rgba(120,205,235,0.26)',
      '--glass-blur': 'blur(38px) saturate(175%)',
      '--glass-shadow': 'inset 0 1px 0 rgba(180,235,255,0.18), 0 24px 70px -26px rgba(4,14,26,0.80)',
      '--app-bg': 'oklch(0.15 0.035 230)',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    desc: 'Near-solid black panels, minimal blur — easiest on the GPU.',
    vars: {
      '--accent': 'oklch(0.62 0.22 280)',
      '--accent-2': 'oklch(0.55 0.24 295)',
      '--accent-glow': 'rgba(124,58,237,0.40)',
      '--grad-btn': 'linear-gradient(135deg, oklch(0.62 0.22 280), oklch(0.55 0.24 295))',
      '--glass-bg': 'linear-gradient(160deg, rgba(13,13,20,0.96), rgba(5,5,11,0.98))',
      '--glass-border': 'rgba(255,255,255,0.07)',
      '--glass-blur': 'blur(8px) saturate(120%)',
      '--glass-shadow': 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 50px -28px rgba(0,0,0,0.90)',
      '--app-bg': '#04040a',
    },
  },
]

export const DEFAULT_UI_THEME = 'default'

export function getUiTheme(id: string | undefined): UiTheme {
  return UI_THEMES.find(t => t.id === id) ?? UI_THEMES[0]
}

/** Write a theme's tokens onto <html> so the whole app reskins immediately. */
export function applyUiTheme(id: string | undefined): void {
  const theme = getUiTheme(id)
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Design language (orthogonal to the color theme above)
//
// 'classic' is the original look. 'modern' flips on `data-design="modern"` on
// <html>, which a scoped CSS layer in index.css keys off to restyle every shared
// surface/button/input (crisp, flat, low-blur "clean dashboard"). It's a complete
// reskin that's fully reversible — removing the attribute restores the classic UI
// exactly, with no rebuild needed. The active COLOR theme still applies on top.
// ─────────────────────────────────────────────────────────────────────────────

export type UiDesign = 'classic' | 'modern'

export function applyUiDesign(mode: UiDesign | undefined): void {
  const root = document.documentElement
  if (mode === 'modern') root.setAttribute('data-design', 'modern')
  else root.removeAttribute('data-design')
}
