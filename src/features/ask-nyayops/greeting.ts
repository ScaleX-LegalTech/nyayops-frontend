/** Time-of-day greeting word for the empty state (redesign doc ask #3) - pure
 * function so both AskNyayOpsPage and AskNyayOpsLauncher render the same
 * greeting without duplicating the hour-bucket logic. */
export function timeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
