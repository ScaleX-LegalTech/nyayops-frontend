/**
 * Recharts reads `fill`/`stroke` as plain SVG attributes, which can't resolve
 * CSS custom properties — so these mirror the OKLCH `@theme` tokens in
 * tokens.css as literal hex strings (resolved via canvas 2D fillStyle, the one
 * reliable way to get an OKLCH->sRGB conversion that matches what the browser
 * actually paints). Keep in sync if the palette in tokens.css changes.
 */
export const STATUS_COLORS = [
  '#2563EB', // brand (--color-brand)
  '#007694', // info (--color-info)
  '#26753E', // success (--color-success)
  '#BE5A0A', // warning (--color-warning)
  '#C22826', // danger (--color-danger)
  '#1D4ED8', // brand-strong (--color-brand-strong)
  '#64748B', // neutral (--color-ink-muted)
]

export const CHART_AXIS_TICK = '#64748B' // --color-ink-muted
export const CHART_TOOLTIP_CURSOR = '#F1F5F9' // --color-surface-muted
export const CHART_BAR_FILL = '#2563EB' // --color-brand
