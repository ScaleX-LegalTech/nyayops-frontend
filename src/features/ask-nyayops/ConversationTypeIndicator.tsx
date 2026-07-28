import { Capsule } from '@/components/ui/Badge'
import { MODULE_ICONS, MODULE_OPTIONS, inferModuleFromEntries } from './filterHelpers'
import type { ChatEntry } from './useAskNyayOpsChat'

/** Sits at the top of the active thread so a user opening an old conversation
 * (or one handed off from the launcher) knows what it's about before reading
 * any messages - the chat-vs-work-tool distinction from the redesign doc's
 * ask #7. Renders nothing for a still-empty thread (see
 * inferModuleFromEntries's doc comment) rather than guess. */
export function ConversationTypeIndicator({ entries }: { entries: ChatEntry[] }) {
  const module_ = inferModuleFromEntries(entries)
  if (!module_) return null
  const Icon = MODULE_ICONS[module_]
  const label = MODULE_OPTIONS.find((o) => o.value === module_)?.label ?? module_
  return (
    <Capsule tone="brand" icon={Icon}>
      {label}
    </Capsule>
  )
}
