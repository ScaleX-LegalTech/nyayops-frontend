import { RotateCcw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { Case, CaseLifecycleStage } from '@/types'
import { CASE_LIFECYCLE_STAGES } from '@/types'
import { cn } from '@/lib/cn'
import { Card, CardBody } from '@/components/ui/Card'
import { updateCaseLifecycleStage } from '@/lib/api/cases'
import { invalidateCaseScopes, qk } from '@/lib/queryKeys'
import { useMutationWithToast } from '@/lib/useMutationWithToast'
import { useToast } from '@/components/ui/Toast'
import { usePermissions } from '@/lib/usePermissions'

const STAGE_LABELS: Record<CaseLifecycleStage, string> = {
  collection: 'Collection',
  scrutiny: 'Scrutiny',
  filed: 'Suit filed',
  cnr_linked: 'CNR linked',
  research_draft: 'Research & draft',
  hearing: 'Hearing',
  disposed: 'Disposed',
}

/**
 * The firm's actual SOP: an associate collects documents from the client, a
 * team member scrutinizes them, a suit is filed, the CNR is linked once the
 * e-court assigns one, then the advocate researches/drafts and appears at
 * hearings — looping back to research/drafting on a re-hearing — until the
 * court disposes the matter. Backed by `Case.lifecycle_stage`; older cases
 * created before this field existed fall back to the collection stage.
 */
export function CaseLifecycleTracker({ c }: { c: Case }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { hasPermission } = usePermissions()
  const current = CASE_LIFECYCLE_STAGES.indexOf(c.lifecycle_stage ?? 'collection')

  const mutation = useMutationWithToast({
    mutationFn: (stage: CaseLifecycleStage) => updateCaseLifecycleStage(c.id, stage),
    onSuccess: () => {
      invalidateCaseScopes(queryClient)
      queryClient.invalidateQueries({ queryKey: qk.caseDetail(c.id) })
      toast('Stage updated.', 'success')
    },
    errorFallback: 'Could not update stage.',
  })

  const canEdit = hasPermission('cases', 'update')

  return (
    <Card>
      <CardBody className="py-4">
        <div className="flex items-center overflow-x-auto">
          {CASE_LIFECYCLE_STAGES.map((stage, i) => {
            const done = i < current
            const active = i === current
            return (
              <div key={stage} className="flex flex-1 items-center last:flex-none">
                <button
                  type="button"
                  disabled={!canEdit || mutation.isPending}
                  onClick={() => mutation.mutate(stage)}
                  className={cn(
                    'flex shrink-0 flex-col items-center gap-1.5',
                    canEdit && 'cursor-pointer',
                  )}
                >
                  <span
                    className={cn('dot size-2', done || active ? 'bg-brand' : 'bg-border-strong')}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'whitespace-nowrap text-xs',
                      active ? 'font-medium text-ink' : 'text-ink-faint',
                    )}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                </button>
                {i < CASE_LIFECYCLE_STAGES.length - 1 && (
                  <div className={cn('mx-2 h-px min-w-6 flex-1', done ? 'bg-brand' : 'bg-border')} />
                )}
              </div>
            )
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
          <RotateCcw className="size-3.5" aria-hidden />
          Click a stage to move the case there — hearing can loop back to research &amp;
          draft on a re-hearing.
        </p>
      </CardBody>
    </Card>
  )
}
