import type { AskNyayOpsAgent } from '@/types'

/** Curated starter prompts shown as clickable chips on a fresh conversation
 * (Google Help's "Ask Google Help" panel pattern) - a blank input box is a
 * blank-page problem; these give a one-click example of what each agent can
 * actually do. Static and short by design - these are examples, not a menu. */
export const SUGGESTED_PROMPTS: Record<AskNyayOpsAgent, string[]> = {
  case_billing: [
    "What's overdue this week?",
    'Show my open cases',
    'Raise a bill for a case',
  ],
  org_access: ['What roles do we have?', 'List all branches', 'Invite a new team member'],
}
