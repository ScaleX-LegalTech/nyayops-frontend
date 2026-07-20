import { useState, type FormEvent } from 'react'
import { Send, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Field, PasswordInput, Textarea } from '@/components/ui/Field'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { cn } from '@/lib/cn'
import { MarkdownLite } from '@/lib/markdownLite'
import { askBootstrap, describeAskNyayOpsError } from '@/lib/api/askNyayOps'
import type { RegisterTenantPayload } from '@/lib/api/auth'
import type { BootstrapMessage, PendingAction } from '@/types'

interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  content: string
  pendingAction?: PendingAction
}

interface BootstrapRegistrationConfirmProps {
  pendingAction: PendingAction
  onDiscard: () => void
  onRegister: (payload: RegisterTenantPayload) => void
  registering: boolean
  registerError: string | null
}

/** draft_org_registration's pending_action (action_type "org.register") is
 * the one and only thing the Bootstrap agent can ever produce - deliberately
 * not routed through the generic PendingActionCard, which has nothing like
 * this: it needs to collect a password inline (the chat is never allowed to
 * ask for one) and its "confirm" calls the real /auth/register-tenant flow,
 * including the OTP step, not a plain toast-on-success. */
function BootstrapRegistrationConfirm({
  pendingAction,
  onDiscard,
  onRegister,
  registering,
  registerError,
}: BootstrapRegistrationConfirmProps) {
  const [password, setPassword] = useState('')
  const after = pendingAction.after_state as {
    organization_name: string
    organization_slug: string
    admin_name: string
    admin_email: string
  }
  const canSubmit = password.length >= 10

  return (
    <Card className="animate-message-in mt-2">
      <CardHeader
        title="Confirm your workspace"
        description="Ask NyayOps drafted this plan - nothing is created until you set a password and confirm."
      />
      <CardBody className="flex flex-col gap-3">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">Organization</dt>
            <dd className="text-ink">{after.organization_name}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">Workspace slug</dt>
            <dd className="text-ink">{after.organization_slug}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-muted">Admin</dt>
            <dd className="text-ink">
              {after.admin_name} &lt;{after.admin_email}&gt;
            </dd>
          </div>
        </dl>
        <Field
          label="Password"
          htmlFor="bootstrap-pw"
          hint="At least 10 characters - the chat never asks for this, you set it here."
        >
          <PasswordInput
            id="bootstrap-pw"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            autoFocus
          />
        </Field>
        {registerError && <p className="text-sm text-danger">{registerError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onDiscard} disabled={registering}>
            Discard
          </Button>
          <Button
            size="sm"
            loading={registering}
            disabled={!canSubmit}
            onClick={() =>
              onRegister({
                organization_name: after.organization_name,
                organization_slug: after.organization_slug,
                admin_name: after.admin_name,
                admin_email: after.admin_email,
                admin_password: password,
              })
            }
          >
            Create organization
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

interface BootstrapChatProps {
  onRegister: (payload: RegisterTenantPayload) => void
  registering: boolean
  registerError: string | null
}

/** Chat-based alternative to the plain signup form (implementation plan §5) -
 * additive, not a replacement: RegisterPage keeps the existing form as the
 * default, this is a toggle. Stateless like the backend's Bootstrap agent -
 * no conversation_id, resends the running `history` every turn. */
export function BootstrapChat({ onRegister, registering, registerError }: BootstrapChatProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const message = input.trim()
    if (!message || loading) return
    const history: BootstrapMessage[] = turns.map((t) => ({ role: t.role, content: t.content }))

    setTurns((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: message }])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const response = await askBootstrap(message, history)
      setTurns((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.reply,
          pendingAction: response.pending_action ?? undefined,
        },
      ])
    } catch (err) {
      setError(describeAskNyayOpsError(err))
    } finally {
      setLoading(false)
    }
  }

  function resolvePending(turnId: string) {
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, pendingAction: undefined } : t)))
  }

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex-1 overflow-y-auto p-4">
        {turns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
              <NyayOpsMark size={22} />
            </div>
            <p className="max-w-xs text-sm text-ink-muted">
              Tell me your firm's name and your details, and I'll set up your workspace.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={cn(
                  'animate-message-in flex gap-3',
                  turn.role === 'user' && 'flex-row-reverse',
                )}
              >
                {turn.role === 'user' ? (
                  <div className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-muted text-ink-muted">
                    <User className="size-3.5" />
                  </div>
                ) : (
                  <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <NyayOpsMark size={15} />
                  </div>
                )}
                <div className={cn('max-w-[85%] min-w-0', turn.role === 'user' && 'items-end')}>
                  {turn.role === 'user' ? (
                    <div className="rounded-card bg-brand px-4 py-2.5 text-sm whitespace-pre-wrap text-white">
                      {turn.content}
                    </div>
                  ) : (
                    <div className="space-y-1.5 py-0.5 text-[0.9375rem] leading-relaxed text-ink">
                      <MarkdownLite text={turn.content} />
                    </div>
                  )}
                  {turn.pendingAction && (
                    <BootstrapRegistrationConfirm
                      pendingAction={turn.pendingAction}
                      onDiscard={() => resolvePending(turn.id)}
                      onRegister={onRegister}
                      registering={registering}
                      registerError={registerError}
                    />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="animate-message-in flex items-center gap-3">
                <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <NyayOpsMark size={15} animate />
                </div>
                <span className="text-sm text-ink-muted">Thinking…</span>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p className="border-t border-border px-4 py-2 text-sm text-danger">{error}</p>}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder="e.g. Acme Legal LLP, admin is Priya Sharma, priya@acme.legal"
          rows={2}
          className="min-h-0 flex-1"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}
