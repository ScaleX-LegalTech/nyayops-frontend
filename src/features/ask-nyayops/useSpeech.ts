import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  bootstrapSpeechToText,
  bootstrapTextToSpeech,
  describeAskNyayOpsError,
  speechToText,
  textToSpeech,
} from '@/lib/api/askNyayOps'

/** 'bootstrap' targets the unauthenticated pre-signup routes (BootstrapChat,
 * no tenant token exists yet, rate-limited by caller IP) - everywhere else
 * uses the default tenant-scoped ones. */
export type VoiceScope = 'tenant' | 'bootstrap'

/** Voice in/out for Ask NyayOps (redesign doc Part H) - both halves are thin
 * wrappers over ask-nyayops-service's Sarvam-backed /speech-to-text and
 * /text-to-speech proxy routes: STT turns a recorded clip into the same text
 * a keyboard would have produced, landing in the input box for review/edit
 * before the user sends it (Q47 fix - finishing the clip no longer submits
 * it automatically), and TTS reads the already-generated reply aloud. No new
 * route, no new tool, no guardrail gets lighter because the input arrived as
 * speech (§H.4) - and a pending action's confirm card always still requires
 * its own explicit button click; a spoken "yes" becomes a plain chat message
 * like any typed one, it never resolves a pending action directly (§H.2). */

// Sarvam's STT is a batch call, not a continuous recognizer - bound one
// clip's length so a forgotten-open mic doesn't run indefinitely (recording
// size, and Sarvam spend, both scale with this).
const MAX_RECORDING_MS = 60_000

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error as Error)
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

/** Push-to-talk speech input: start() records from the mic until stop() (or
 * the safety cutoff above); the finished clip uploads and the transcript is
 * handed to onTranscript once it comes back - callers wire onTranscript to
 * fill the input box for the user to review/edit and send themselves (Q47
 * fix), not to send directly. There's no live interim text the way the old
 * Web Speech API gave (Sarvam transcribes the whole clip at once), so
 * `status` covers the waiting states the button/bubble render instead. */
export function useSpeechInput(onTranscript: (text: string) => void, scope: VoiceScope = 'tenant') {
  // 'starting' covers the getUserMedia() round-trip (including the browser's
  // own permission prompt) - without it the button sat visually idle from
  // click until the mic was actually live, which read as "did that even
  // register?" for anything but an instant permission grant.
  const [status, setStatus] = useState<'idle' | 'starting' | 'recording' | 'transcribing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set by cancel() right before stopping the recorder - onstop checks it to
  // skip transcription/onTranscript entirely rather than sending a clip the
  // user explicitly discarded.
  const discardRef = useRef(false)
  const { toast } = useToast()
  // Keep the latest callback without re-creating start/stop - updated in an
  // effect, not during render, per react-hooks/refs.
  const onTranscriptRef = useRef(onTranscript)
  useEffect(() => {
    onTranscriptRef.current = onTranscript
  })

  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function stop() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  /** Stops recording and throws the clip away - no transcription, no
   * onTranscript call. The only way to back out of a recording without it
   * turning into a sent message. */
  function cancel() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      discardRef.current = true
      mediaRecorderRef.current.stop()
    }
  }

  async function start() {
    if (!supported || status !== 'idle') return
    setStatus('starting')
    let stream: MediaStream
    try {
      // noiseSuppression:false - Chrome's default noise-suppression DSP can
      // over-suppress sustained/longer speech (more likely to misclassify
      // steady speech energy as noise the longer the utterance runs),
      // producing a near-flat waveform Sarvam can't transcribe even though
      // the mic itself is fine. Short utterances rarely trigger this, which
      // is why only longer sentences were affected.
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: false, echoCancellation: true, autoGainControl: true },
      })
    } catch {
      toast("Couldn't access the microphone - check your browser's permission for this site.", 'error')
      setStatus('idle')
      return
    }
    const recorder = new MediaRecorder(stream)
    chunksRef.current = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (discardRef.current) {
        discardRef.current = false
        setStatus('idle')
        return
      }
      const mimeType = recorder.mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      setStatus('transcribing')
      void (async () => {
        try {
          const base64 = await blobToBase64(blob)
          const format = mimeType.split('/')[1]?.split(';')[0] || 'webm'
          const result =
            scope === 'bootstrap'
              ? await bootstrapSpeechToText(base64, format)
              : await speechToText(base64, format)
          if (result.transcript.trim()) onTranscriptRef.current(result.transcript.trim())
          else toast("Didn't catch that - try speaking a bit longer.", 'info')
        } catch (err) {
          toast(describeAskNyayOpsError(err), 'error')
        } finally {
          setStatus('idle')
        }
      })()
    }
    mediaRecorderRef.current = recorder
    recorder.start()
    setStatus('recording')
    timeoutRef.current = setTimeout(stop, MAX_RECORDING_MS)
  }

  return {
    supported,
    listening: status === 'recording',
    busy: status === 'starting' || status === 'transcribing',
    status,
    start,
    stop,
    cancel,
  }
}

const SPEAK_REPLIES_STORAGE_KEY = 'ask_nyayops_speak_replies'

/** Voice out: reads assistant replies aloud via Sarvam TTS when enabled. Off
 * by default and persisted per browser - hearing every answer read out is a
 * mode people opt into, not a surprise. */
export function useSpeakReplies(scope: VoiceScope = 'tenant') {
  const supported = typeof window !== 'undefined' && typeof Audio !== 'undefined'
  const [enabled, setEnabled] = useState(
    () => supported && localStorage.getItem(SPEAK_REPLIES_STORAGE_KEY) === 'true',
  )
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { toast } = useToast()

  function stopCurrent() {
    if (audioRef.current) {
      audioRef.current.pause()
      URL.revokeObjectURL(audioRef.current.src)
      audioRef.current = null
    }
    // Cuts off a still-playing filler phrase the instant the real reply is
    // ready to speak, so the two never overlap.
    window.speechSynthesis?.cancel()
  }

  /** No-op: filler phrases used to play through the browser's built-in TTS
   * while a turn was in flight, which spoke in a different voice than the
   * Sarvam voice used for actual replies. Disabled rather than routed
   * through Sarvam, to avoid adding a network round-trip before the filler
   * could play. */
  function playFiller() {}

  useEffect(() => {
    return () => stopCurrent()
  }, [])

  async function playText(text: string) {
    if (!supported || !text) return
    try {
      const { audio_base64: audioBase64, audio_format: audioFormat } =
        scope === 'bootstrap' ? await bootstrapTextToSpeech(text) : await textToSpeech(text)
      // One reply at a time - a new answer interrupts the previous one
      // instead of queueing a backlog of stale speech.
      stopCurrent()
      const blob = base64ToBlob(audioBase64, `audio/${audioFormat}`)
      const audio = new Audio(URL.createObjectURL(blob))
      audioRef.current = audio
      await audio.play()
    } catch (err) {
      // The reply already rendered as text either way - this toast is a
      // heads-up that voice-out specifically failed, not a chat error.
      toast(`Couldn't play voice reply: ${describeAskNyayOpsError(err)}`, 'error')
    }
  }

  function toggle() {
    setEnabled((previous) => {
      const next = !previous
      localStorage.setItem(SPEAK_REPLIES_STORAGE_KEY, String(next))
      if (next) {
        // Immediate audible confirmation - the user hears that voice is on
        // right now instead of wondering until the next reply.
        void playText('Voice replies on.')
      } else {
        stopCurrent()
      }
      return next
    })
  }

  function speak(text: string) {
    void playText(text)
  }

  return { supported, enabled, toggle, speak, playFiller }
}
