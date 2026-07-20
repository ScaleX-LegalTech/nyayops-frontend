interface NyayOpsMarkProps {
  /** Pixel size (square). */
  size?: number
  /** Loops the draw-in/erase animation - the "Ask NyayOps is thinking" state.
   * Omit for a static, fully-drawn mark (avatars, buttons, empty states). */
  animate?: boolean
  className?: string
}

/** The Ask NyayOps brand mark: a single curved stroke tracing an "N" between
 * two anchor dots, drawn with the SVG pathLength trick (stroke-dasharray/
 * dashoffset normalized to 1 regardless of actual path length) so the same
 * markup can sit still or loop as a "thinking" indicator. Inline SVG, not an
 * asset file - it needs to inherit `currentColor` so one component works on
 * a brand-filled button, a white/dark background, or plain ink text. */
export function NyayOpsMark({ size = 20, animate = false, className }: NyayOpsMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path
        d="M9,25 C7,20 7,11 9,7 C11,11 21,21 23,25 C25,21 25,11 23,7"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className={animate ? 'nyayops-mark-path' : undefined}
        style={animate ? undefined : { strokeDasharray: 1, strokeDashoffset: 0 }}
      />
      <circle cx="9" cy="25" r="2.25" fill="currentColor" className={animate ? 'nyayops-mark-dot-a' : undefined} />
      <circle cx="23" cy="7" r="2.25" fill="currentColor" className={animate ? 'nyayops-mark-dot-b' : undefined} />
    </svg>
  )
}
