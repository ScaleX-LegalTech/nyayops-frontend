import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowUp,
  Briefcase,
  Check,
  Loader2,
  Mic,
  Paperclip,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useFloatingPanel, useOutsideClose } from '@/components/ui/useFloatingPanel'
import { useToast } from '@/components/ui/Toast'
import { listCaseOptions } from '@/lib/api/cases'
import { formatBytes } from '@/lib/format'
import { qk } from '@/lib/queryKeys'
import { clearStagedAttachment, stageAttachment, useStagedAttachment } from './chatAttachmentStore'
import { useSpeechInput, type VoiceScope } from './useSpeech'

const MENTION_DEBOUNCE_MS = 300

/** The mic control's shape - `useStreamingVoice` (WebSocket push-to-talk) or
 * `useSpeechInput` (batch record-then-upload) both satisfy it, so
 * ChatInputBar's UI doesn't care which is actually driving it. */
export interface VoiceInputAdapter {
  supported: boolean
  status: 'idle' | 'starting' | 'recording' | 'transcribing'
  start: () => void
  stop: () => void
  cancel: () => void
  /** Real mic input level, 0-1, sampled a few times a second - omitted (or
   * always 0) for adapters with no live level to report, like the batch
   * fallback, in which case the waveform falls back to a decorative pulse. */
  audioLevel?: number
}

interface ChatInputBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onTranscript: (text: string) => void
  /** True while `value` is a not-yet-sent voice transcript (Q47 fix) - shows
   * a "review before sending" hint instead of silently auto-sending. */
  voiceDraft?: boolean
  loading: boolean
  placeholder: string
  speechSupported: boolean
  speakReplies: boolean
  onToggleSpeakReplies: () => void
  scope?: VoiceScope
  /** The WebSocket-backed mic (useStreamingVoice) - the default, faster path.
   * When the browser doesn't support it (`voice.supported === false` - no
   * AudioWorklet/WebSocket), this component falls back to its own internal
   * batch mic (useSpeechInput) instead of just hiding the mic button, so
   * voice input still works, just slower. */
  voice: VoiceInputAdapter
}

const WAVEFORM_BAR_COUNT = 140

/** One pill-shaped input bar shared by the three authenticated Ask NyayOps
 * chat surfaces (AskNyayOpsPage, AskNyayOpsLauncher, OrgSetupPage) - not
 * BootstrapChat, which is unauthenticated and uses VoiceControls.tsx/
 * useSpeechInput directly instead. Replaces the old textarea+separate-buttons
 * row. Adapted to the app's own
 * light "ledger blue" palette rather than the dark reference it was modeled
 * on - same shape/states, this product's own tokens.
 *
 * Right-side slot is one control that changes meaning by state, same pattern
 * WhatsApp/most chat apps use: empty input -> mic, typed text -> send,
 * recording -> discard(X)/stop-and-send(check), transcribing -> discard
 * (disabled)/spinner. Only one action is ever live at a time, so there's
 * never a moment with two conflicting affordances competing for the same
 * tap. While recording, the waveform bars track `voice.audioLevel` - real mic
 * input level, not a canned animation - specifically so a user can tell at a
 * glance whether their voice is actually being picked up, not just that a
 * recording is technically in progress. Falls back to a decorative pulse for
 * states with no live level to show (batch fallback, transcribing/starting).
 *
 * Continuous/VAD-driven voice (auto-listen, auto-barge-in) was tried and
 * rolled back - it broke this click-to-talk -> Check-to-send flow. `voice`
 * (useStreamingVoice, WebSocket-backed) drives the mic when supported;
 * turn-taking stays fully manual either way - see its own doc comment. */
export function ChatInputBar({
  value,
  onChange,
  onSubmit,
  onTranscript,
  voiceDraft = false,
  loading,
  placeholder,
  speechSupported,
  speakReplies,
  onToggleSpeakReplies,
  scope = 'tenant',
  voice,
}: ChatInputBarProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const stagedFile = useStagedAttachment()
  // The exact hint substring last appended to `value` for the currently
  // staged file, so removing the attachment can strip it back out instead of
  // leaving stale bracketed text behind.
  const [attachHint, setAttachHint] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function attachFile(file: File) {
    const error = stageAttachment(file)
    if (error) {
      toast(error, 'error')
      return
    }
    const hint = `[Attached: ${file.name} (${formatBytes(file.size)})]`
    onChange(value.trim() ? `${value}\n${hint}` : hint)
    setAttachHint(hint)
  }

  function removeAttachment() {
    clearStagedAttachment()
    if (attachHint) {
      onChange(value.replace(`\n${attachHint}`, '').replace(attachHint, ''))
      setAttachHint(null)
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) attachFile(file)
  }

  // Always called (Rules of Hooks) even when `voice` is supported and used
  // instead - no side effect until start() is actually clicked, so this is
  // free when unused.
  const batchFallback = useSpeechInput(onTranscript, scope)
  const stt: VoiceInputAdapter = voice.supported ? voice : batchFallback
  const recording = stt.status === 'recording'
  const transcribing = stt.status === 'transcribing'
  const starting = stt.status === 'starting'
  const showWaveform = recording || transcribing || starting
  const hasLiveLevel = typeof stt.audioLevel === 'number'

  // "@" case/client mention (redesign doc ask #9) - reuses MentionTextarea's
  // interaction shape (detect trigger, portaled suggestion list, insert on
  // pick) but backed by a live case search (listCaseOptions, the same API
  // CaseCombobox uses) instead of a fixed people list, since "@" here means
  // "which matter is this about," not "which teammate."
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionDebounced, setMentionDebounced] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [mentionHighlighted, setMentionHighlighted] = useState(0)
  const { triggerRef: textareaRef, panelRef: mentionPanelRef, pos: mentionPos } =
    useFloatingPanel<HTMLTextAreaElement>(mentionOpen)
  useOutsideClose(mentionOpen, [textareaRef, mentionPanelRef], () => setMentionOpen(false))

  useEffect(() => {
    const id = setTimeout(() => setMentionDebounced(mentionQuery), MENTION_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [mentionQuery])

  const mentionResults = useQuery({
    queryKey: qk.caseOptions({ query: mentionDebounced || undefined, limit: 6 }),
    queryFn: () => listCaseOptions({ query: mentionDebounced || undefined, limit: 6 }),
    enabled: mentionOpen,
  })
  const mentionSuggestions = mentionOpen ? (mentionResults.data ?? []) : []

  function pickMention(title: string) {
    if (mentionStart === null) return
    const cursor = textareaRef.current?.selectionStart ?? value.length
    onChange(`${value.slice(0, mentionStart)}@${title} ${value.slice(cursor)}`)
    setMentionOpen(false)
  }

  function handleInputChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value
    onChange(next)
    const cursor = e.target.selectionStart ?? next.length
    const beforeCursor = next.slice(0, cursor)
    const at = beforeCursor.lastIndexOf('@')
    if (at === -1 || /\s/.test(beforeCursor.slice(at + 1))) {
      setMentionOpen(false)
      return
    }
    setMentionQuery(beforeCursor.slice(at + 1))
    setMentionStart(at)
    setMentionHighlighted(0)
    setMentionOpen(true)
  }

  // A scrolling strip of the last WAVEFORM_BAR_COUNT level samples - each new
  // reading pushes onto the end, oldest drops off the front, so the bars read
  // as a live level history rather than one value applied uniformly (which
  // would just pulse as a single block, not really look like a waveform).
  // Derived directly during render (React's own pattern for "adjust state
  // when a prop/value changes" without the extra round trip an effect would
  // add) rather than in a useEffect - stt.audioLevel already updates on its
  // own timer inside useStreamingVoice, so this only needs to react to it.
  const [levelHistory, setLevelHistory] = useState<number[]>(() => Array(WAVEFORM_BAR_COUNT).fill(0))
  const [trackedLevel, setTrackedLevel] = useState(stt.audioLevel)
  if (recording && hasLiveLevel && stt.audioLevel !== trackedLevel) {
    setTrackedLevel(stt.audioLevel)
    setLevelHistory((prev) => [...prev.slice(1), stt.audioLevel ?? 0])
  }
  if (!recording && levelHistory.some((v) => v !== 0)) {
    setLevelHistory(Array(WAVEFORM_BAR_COUNT).fill(0))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionOpen && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionHighlighted((h) => (h + 1) % mentionSuggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionHighlighted((h) => (h - 1 + mentionSuggestions.length) % mentionSuggestions.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        pickMention(mentionSuggestions[mentionHighlighted].title)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionOpen(false)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const showVoiceDraftHint = voiceDraft && !!value.trim() && !showWaveform

  return (
    <div
      className="relative flex min-w-0 max-w-full flex-col gap-1 overflow-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragOver && (
        <div
          className="animate-fade-scale-in pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-card border-2 border-dashed border-brand bg-brand-soft/80 text-sm font-medium text-brand"
          aria-hidden
        >
          Drop to attach
        </div>
      )}

      {stagedFile && (
        <div className="flex items-center gap-2 rounded-control border border-border bg-surface-muted px-3 py-1.5 text-xs text-ink-muted">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            {stagedFile.name} · {formatBytes(stagedFile.size)}
          </span>
          <button
            type="button"
            onClick={removeAttachment}
            aria-label="Remove attachment"
            title="Remove attachment"
            className="shrink-0 rounded-full p-0.5 hover:bg-surface hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div
        className={cn(
          'flex min-w-0 items-center gap-1 rounded-full border bg-surface py-1.5 pr-1.5 pl-2 shadow-sm transition-colors',
          recording ? 'border-danger/40' : 'border-border',
        )}
      >
        {!showWaveform && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) attachFile(file)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach case document"
              title="Attach case document — petition, notice, judgement, contract"
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <Paperclip className="size-4" />
            </button>
          </>
        )}

        {showWaveform ? (
          <div className="flex h-9 min-w-0 flex-1 shrink items-center gap-2 overflow-hidden px-2" aria-hidden>
            <span className="shrink-0 text-xs font-medium text-danger">
              {recording ? 'Listening…' : transcribing ? 'Transcribing…' : 'Starting…'}
            </span>
            <div className="flex h-full min-w-0 flex-1 shrink items-center gap-px overflow-hidden">
              {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, i) =>
                recording && hasLiveLevel ? (
                  // Real mic level, not a canned animation - see this
                  // component's own doc comment for why that matters.
                  <span
                    key={i}
                    className="min-w-px flex-1 rounded-full bg-brand transition-[height] duration-75 ease-out"
                    style={{ height: `${Math.min(100, 15 + levelHistory[i] * 85)}%` }}
                  />
                ) : (
                  <span
                    key={i}
                    className={cn(
                      'min-w-px flex-1 rounded-full',
                      recording ? 'animate-waveform-bar bg-brand' : 'bg-ink-faint/40',
                    )}
                    style={
                      recording
                        ? {
                            height: '100%',
                            animationDuration: `${0.55 + (i % 5) * 0.1}s`,
                            animationDelay: `${(i % 7) * 0.06}s`,
                          }
                        : { height: '35%' }
                    }
                  />
                ),
              )}
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            role="combobox"
            aria-expanded={mentionOpen && mentionSuggestions.length > 0}
            aria-controls="chat-mention-suggestions"
            className="max-h-32 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
        )}

        {mentionOpen &&
          mentionSuggestions.length > 0 &&
          createPortal(
            <div
              ref={mentionPanelRef}
              id="chat-mention-suggestions"
              role="listbox"
              className="fixed w-64 rounded-card border border-border bg-surface p-1 shadow-pop animate-rise"
              style={{ top: mentionPos.top, left: mentionPos.left, zIndex: 'var(--z-popover)' }}
            >
              {mentionSuggestions.map((option, i) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={i === mentionHighlighted}
                  onMouseEnter={() => setMentionHighlighted(i)}
                  onClick={() => pickMention(option.title)}
                  className={cn(
                    'flex w-full items-center gap-2 truncate rounded-control px-2.5 py-1.5 text-left text-sm text-ink',
                    i === mentionHighlighted ? 'bg-surface-muted' : 'hover:bg-surface-muted',
                  )}
                >
                  <Briefcase className="size-3.5 shrink-0 text-ink-faint" /> {option.title}
                </button>
              ))}
            </div>,
            document.body,
          )}

        {recording ? (
          <>
            <button
              type="button"
              onClick={stt.cancel}
              aria-label="Discard recording"
              title="Discard recording"
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              onClick={stt.stop}
              aria-label="Stop and send"
              title="Stop and send"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-strong"
            >
              <Check className="size-4" />
            </button>
          </>
        ) : transcribing ? (
          <>
            <span className="grid size-9 shrink-0 place-items-center rounded-full text-ink-faint opacity-40">
              <X className="size-4" />
            </span>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white">
              <Loader2 className="size-4 animate-spin" />
            </span>
          </>
        ) : value.trim() ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            aria-label="Send"
            title="Send"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
          >
            <ArrowUp className="size-4" />
          </button>
        ) : stt.supported ? (
          <button
            type="button"
            onClick={stt.start}
            disabled={starting || loading}
            aria-label="Tap to speak"
            title="Tap to speak"
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-muted hover:text-ink disabled:opacity-40"
          >
            <Mic className="size-4" />
          </button>
        ) : (
          <span className="size-9 shrink-0" aria-hidden />
        )}

        {speechSupported && (
          <button
            type="button"
            onClick={onToggleSpeakReplies}
            aria-label={speakReplies ? 'Stop reading replies aloud' : 'Read replies aloud'}
            title={speakReplies ? 'Stop reading replies aloud' : 'Read replies aloud'}
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-full transition-colors',
              speakReplies
                ? 'bg-brand-soft text-brand'
                : 'text-ink-faint hover:bg-surface-muted hover:text-ink',
            )}
          >
            {speakReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </button>
        )}
      </div>

      {showVoiceDraftHint && (
        <p className="flex items-center gap-1 pl-3 text-xs text-ink-faint">
          <Mic className="size-3" /> Heard this — review or edit, then send.
        </p>
      )}
    </div>
  )
}
