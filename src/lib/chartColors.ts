/**
 * Recharts reads `fill`/`stroke` as plain SVG attributes, which can't resolve
 * CSS custom properties — so these mirror the `@theme` tokens in index.css as
 * literal hex strings. Keep in sync if the palette changes.
 */
export const STATUS_COLORS = [
  '#8C6A2E', // brand / accent (bronze)
  '#3C4A52', // info / normal
  '#8C6A2E', // accent
  '#8C6A2E', // warning / soon (reuses accent bronze)
  '#3F5C43', // success
  '#7A3B32', // danger / urgent
  '#6E6A61', // neutral
]

export const CHART_AXIS_TICK = '#6E6A61'
export const CHART_TOOLTIP_CURSOR = '#F8F7F3'
export const CHART_BAR_FILL = '#8C6A2E'
