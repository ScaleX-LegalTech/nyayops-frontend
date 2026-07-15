let sharedContext: AudioContext | null = null

/** Two-tone chime synthesized with the Web Audio API - no audio asset to ship or
 * license, and it respects the browser's autoplay policy (only ever called from a
 * user-session-scoped SW message handler, never on page load). */
export function playNotificationSound(): void {
  try {
    sharedContext ??= new AudioContext()
    const ctx = sharedContext
    const now = ctx.currentTime

    ;[880, 1174.66].forEach((frequency, i) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      const start = now + i * 0.12
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.3)
    })
  } catch {
    // Web Audio unavailable/blocked - the toast still shows, sound is a bonus.
  }
}
