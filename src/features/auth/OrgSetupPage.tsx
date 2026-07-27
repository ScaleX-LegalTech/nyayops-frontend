import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Scale } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NyayOpsMark } from '@/components/ui/NyayOpsMark'
import { ChatInputBar } from '@/features/ask-nyayops/ChatInputBar'
import { ChatMessageList } from '@/features/ask-nyayops/ChatMessageList'
import { useAskNyayOpsChat } from '@/features/ask-nyayops/useAskNyayOpsChat'

/** Setup is done by asking, not by clicking through forms - org_access already
 * covers every first-run task (invite teammates, add a branch, configure
 * roles) as normal Ask NyayOps tool calls with the usual dry-run confirm
 * cards, so this page is just the authenticated chat again, framed as
 * onboarding, with its own setup-flavored starter prompts instead of the
 * general ones. */
const SETUP_PROMPTS = [
  'Invite my team',
  'Add a branch',
  'Set up roles and permissions',
  'Show me what Ask NyayOps can do',
]

/** Shown once, immediately after registering a new workspace (RegisterPage's
 * completeRegistration/submitOtp both navigate here instead of straight to
 * /dashboard) - never re-shown automatically afterward. Deliberately outside
 * AppShell (no sidebar/topbar chrome) so it reads as its own full-page step,
 * the same way /login does, rather than a dashboard with a banner on it. */
export default function OrgSetupPage() {
  const navigate = useNavigate()
  const {
    entries,
    input,
    setInput,
    loading,
    handleSubmit,
    sendMessage,
    retryMessage,
    resolvePending,
    speechSupported,
    speakReplies,
    toggleSpeakReplies,
    voice,
    inputFromVoice,
    receiveVoiceTranscript,
  } = useAskNyayOpsChat()

  function skip() {
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="grid h-dvh overflow-hidden lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-shell p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '22px 22px',
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-control bg-accent/15 text-accent">
            <Scale className="size-6" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">
            Nyay<span className="text-accent">Ops</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white">
            Your workspace is ready.
          </h2>
          <p className="mt-4 text-white/60">
            Tell Ask NyayOps what to set up first - invite your team, add a branch, configure
            roles - or skip ahead and do it later from Settings.
          </p>
        </div>

        <p className="relative text-sm text-white/40">
          Everything it sets up is a draft you confirm - nothing happens until you approve it.
        </p>
      </aside>

      <main className="flex h-full min-h-0 flex-col overflow-hidden bg-bg">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <NyayOpsMark size={18} className="text-brand" /> Let's set up your workspace
          </p>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" replace className="text-sm text-ink-muted hover:text-ink">
              I'll do this later
            </Link>
            <Button variant="secondary" size="sm" onClick={skip}>
              Skip to dashboard <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <ChatMessageList
            entries={entries}
            loading={loading}
            onResolvePending={resolvePending}
            onSelectSource={(source) => void sendMessage(source.label)}
            onRetry={(entryId) => void retryMessage(entryId)}
            emptyState={
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand">
                  <NyayOpsMark size={28} />
                </div>
                <div>
                  <p className="type-greeting text-lg text-ink">What should we set up first?</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Type it or say it - Ask NyayOps drafts the change, you confirm it.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                  {SETUP_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="rounded-control border border-border px-3.5 py-2 text-left text-sm font-medium text-ink transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand-strong"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            }
          />
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <ChatInputBar
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onTranscript={receiveVoiceTranscript}
            loading={loading}
            placeholder="e.g. Invite priya@acme.legal as an admin"
            speechSupported={speechSupported}
            speakReplies={speakReplies}
            onToggleSpeakReplies={toggleSpeakReplies}
            voice={voice}
            voiceDraft={inputFromVoice}
          />
        </div>
      </main>
    </div>
  )
}
