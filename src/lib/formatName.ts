/** Renders a person's admin-configured prefix/suffix around their name, e.g.
 * "Adv. Himanshu Singh" or "Priya (Intern)". Display only - never use this for
 * @mention text insertion/matching (see lib/mentions.ts), which keys on full_name. */
export function displayName(person: {
  full_name: string
  name_prefix?: string | null
  name_suffix?: string | null
}): string {
  return [person.name_prefix, person.full_name, person.name_suffix].filter(Boolean).join(' ')
}
