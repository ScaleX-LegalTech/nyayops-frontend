/** Static Indian public-holiday data for calendar shading - NOT sourced from a live
 * feed (no such integration exists yet; see AGENTS.md/CLAUDE.md's "never fetch
 * unapproved external URLs" rule). Fixed-date national holidays are exact; every
 * lunar/Islamic-calendar festival is `approx: true` since its Gregorian date shifts
 * year to year and by regional moon-sighting - treat those as indicative only.
 * High-Court-specific vacation/non-working days (each court publishes its own
 * calendar and they differ by state) are deliberately NOT included here - there's
 * no single reliable source for them, and guessing would be worse than omitting.
 * Replace this file with a real feed (e.g. a maintained Indian-holidays API or the
 * National Judicial Data Grid) before relying on it for anything but a demo. */

export type HolidayType = 'national' | 'festival'

export interface IndianHoliday {
  date: string // yyyy-MM-dd
  name: string
  type: HolidayType
  /** Date depends on the lunar/Islamic calendar or regional sighting - may be off
   * by a day or two from the eventual government-gazetted date. */
  approx?: boolean
}

const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 26, name: 'Republic Day' },
  { month: 8, day: 15, name: 'Independence Day' },
  { month: 10, day: 2, name: 'Gandhi Jayanti' },
  { month: 12, day: 25, name: 'Christmas' },
]

/** Best-effort estimates for movable festivals, current year only - extend this map
 * as needed. Every entry here is approximate (see file header). */
const MOVABLE_FESTIVALS_2026: { date: string; name: string }[] = [
  { date: '2026-03-04', name: 'Holi' },
  { date: '2026-03-20', name: 'Eid-ul-Fitr' },
  { date: '2026-03-31', name: 'Mahavir Jayanti' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Buddha Purnima' },
  { date: '2026-05-27', name: 'Eid-ul-Adha' },
  { date: '2026-06-17', name: 'Muharram' },
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-08', name: 'Diwali' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function buildFixedHolidays(years: number[]): IndianHoliday[] {
  return years.flatMap((year) =>
    FIXED_HOLIDAYS.map((h) => ({
      date: `${year}-${pad(h.month)}-${pad(h.day)}`,
      name: h.name,
      type: 'national' as const,
    })),
  )
}

const HOLIDAYS: IndianHoliday[] = [
  ...buildFixedHolidays([2025, 2026, 2027]),
  ...MOVABLE_FESTIVALS_2026.map((f) => ({ ...f, type: 'festival' as const, approx: true })),
].sort((a, b) => a.date.localeCompare(b.date))

const BY_DATE = new Map<string, IndianHoliday>(HOLIDAYS.map((h) => [h.date, h]))

export function getHoliday(dateIso: string): IndianHoliday | undefined {
  return BY_DATE.get(dateIso)
}

export function getHolidaysInRange(startIso: string, endIso: string): IndianHoliday[] {
  return HOLIDAYS.filter((h) => h.date >= startIso && h.date <= endIso)
}
