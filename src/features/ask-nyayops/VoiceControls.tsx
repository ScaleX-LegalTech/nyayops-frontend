import { Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSpeechInput, type VoiceScope } from './useSpeech'

const STATUS_LABEL: Record<'starting' | 'recording' | 'transcribing', string> = {
  starting: 'Starting…',
  recording: 'Recording…',
  transcribing: 'Transcribing…',
}

interface VoiceControlsProps {
  /** Called with the finished transcript once it comes back - callers wire
   * this straight to sendMessage() so stopping the recording submits it
   * immediately (redesign doc §H.1: voice feeds the same send pipeline a
   * typed-and-Enter'd message would). */
  onTranscript: (text: string) => void
  speechSupported: boolean
  speakReplies: boolean
  onToggleSpeakReplies: () => void
  /** True while a previous message is still awaiting its reply. onTranscript
   * now sends directly (see above), and sendMessage() silently no-ops while
   * loading - without this the mic button would stay clickable and a voice
   * turn started mid-reply would just vanish with no feedback. */
  loading?: boolean
  /** 'bootstrap' for the unauthenticated pre-signup surface (BootstrapChat) -
   * see useSpeech.ts's VoiceScope. Defaults to the normal tenant-scoped
   * routes used everywhere else. */
  scope?: VoiceScope
}

/** The mic (speech-to-text) and speaker (read-replies-aloud) toggles shared by
 * the full page's and the launcher's input rows. Renders nothing at all in
 * browsers without the Web Speech API rather than showing dead buttons. */
export function VoiceControls({
  onTranscript,
  speechSupported,
  speakReplies,
  onToggleSpeakReplies,
  loading = false,
  scope = 'tenant',
}: VoiceControlsProps) {
  const stt = useSpeechInput(onTranscript, scope)
  if (!stt.supported && !speechSupported) return null

  return (
    <>
      {stt.supported && (
        <span className="relative self-end">
          {stt.status !== 'idle' && (
            <span
              aria-live="polite"
              className="absolute right-0 bottom-full mb-2 max-w-[18rem] truncate rounded-control border border-border bg-surface px-3 py-1.5 text-xs whitespace-nowrap text-ink shadow-pop"
            >
              {STATUS_LABEL[stt.status as 'starting' | 'recording' | 'transcribing']}
            </span>
          )}
          <button
            type="button"
            onClick={() => (stt.listening ? stt.stop() : stt.start())}
            disabled={stt.busy || (loading && !stt.listening)}
            aria-label={stt.listening ? 'Stop voice input' : 'Start voice input'}
            title={
              loading && !stt.listening
                ? 'Waiting for the last reply…'
                : stt.listening
                  ? 'Stop voice input'
                  : 'Speak your question'
            }
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-control border transition-colors disabled:cursor-not-allowed',
              stt.listening
                ? 'animate-pulse border-danger bg-danger/10 text-danger'
                : 'border-border text-ink-faint hover:bg-surface-muted hover:text-ink disabled:opacity-60 disabled:hover:bg-transparent',
            )}
          >
            {stt.listening ? (
              <MicOff className="size-4" />
            ) : stt.busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mic className="size-4" />
            )}
          </button>
        </span>
      )}
      {speechSupported && (
        <button
          type="button"
          onClick={onToggleSpeakReplies}
          aria-label={speakReplies ? 'Stop reading replies aloud' : 'Read replies aloud'}
          title={speakReplies ? 'Stop reading replies aloud' : 'Read replies aloud'}
          className={cn(
            'grid size-9 shrink-0 place-items-center self-end rounded-control border transition-colors',
            speakReplies
              ? 'border-brand bg-brand-soft text-brand'
              : 'border-border text-ink-faint hover:bg-surface-muted hover:text-ink',
          )}
        >
          {speakReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      )}
    </>
  )
}
