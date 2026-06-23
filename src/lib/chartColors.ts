/**
 * Recharts reads `fill`/`stroke` as plain SVG attributes, which can't resolve
 * CSS custom properties — so these mirror the `@theme` tokens in index.css as
 * literal OKLCH strings. Keep in sync if the palette changes.
 */
export const STATUS_COLORS = [
  'oklch(0.48 0.15 235)', // brand
  'oklch(0.58 0.11 215)', // info
  'oklch(0.78 0.13 95)', // accent
  'oklch(0.7 0.13 50)', // warning
  'oklch(0.55 0.11 150)', // success
  'oklch(0.55 0.17 27)', // danger
  'oklch(0.55 0.03 235)', // neutral
]

export const CHART_AXIS_TICK = 'oklch(0.5 0.018 235)'
export const CHART_TOOLTIP_CURSOR = 'oklch(0.97 0.005 235)'
export const CHART_BAR_FILL = 'oklch(0.48 0.15 235)'
