import { Briefcase, IndianRupee, TrendingUp, Users, type LucideIcon } from 'lucide-react'

/** Curated starter prompts shown as clickable chips on a fresh conversation
 * (Google Help's "Ask Google Help" panel pattern) - a blank input box is a
 * blank-page problem; these give a one-click example of what the assistant can
 * actually do. One list across every domain: since the intent router picks the
 * right specialist per turn (invisible seam), the user never needs to know
 * cases and org administration are handled by different agents. Static and
 * short by design - these are examples, not a menu. */
export const SUGGESTED_PROMPTS: string[] = [
  "What's overdue this week?",
  'Show my open cases',
  'Raise a bill for a case',
  'Invite a new team member',
]

/** The empty-state quick-action grid's icon+label dressing for the same four
 * prompts above (same order, same sent text) - a module card reads better as
 * a short label + 2-3 concrete bullets than a single description line, but
 * the actual message sent on click is still just one of SUGGESTED_PROMPTS -
 * bullets are illustrative copy, not separate clickable actions (only the
 * card itself is clickable). Shared by AskNyayOpsPage and AskNyayOpsLauncher
 * so the two empty states never drift apart. */
export interface QuickAction {
  icon: LucideIcon
  label: string
  bullets: string[]
  prompt: string
}

export const QUICK_ACTIONS: QuickAction[] = [
  {
    icon: Briefcase,
    label: 'Cases',
    bullets: ['Find pending matters', 'Track hearing dates', 'Check case status'],
    prompt: SUGGESTED_PROMPTS[1],
  },
  {
    icon: IndianRupee,
    label: 'Billing',
    bullets: ['Raise invoices', 'Find unpaid bills', 'Track collections'],
    prompt: SUGGESTED_PROMPTS[2],
  },
  {
    icon: Users,
    label: 'Team',
    bullets: ['Manage users', 'Review permissions', 'Invite members'],
    prompt: SUGGESTED_PROMPTS[3],
  },
  {
    icon: TrendingUp,
    label: 'Reports',
    bullets: ['Get operational insights'],
    prompt: SUGGESTED_PROMPTS[0],
  },
]
