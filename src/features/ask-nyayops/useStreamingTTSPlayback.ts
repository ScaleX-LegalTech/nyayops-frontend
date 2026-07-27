import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  CLOSE_AUTH_FAILED,
  CLOSE_RATE_LIMITED,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_MAX_DELAY_MS,
  streamingVoiceWsUrl,
} from './streamingVoiceWs'

// Must match ask-nyayops-service's SARVAM_TTS_STREAM_SAMPLE_RATE config default -
// the server picks the rate when it configures the Sarvam session, the browser
// only decodes what arrives, so this is a fixed constant, not negotiated.
const TTS_SAMPLE_RATE = 24000

// Splits a finished reply into sentence-sized chunks to send progressively
// (redesign doc's already-confirmed scope: sentence-chunked from the final
// reply, not token-level Gemini streaming) - so playback of sentence 1 can
// start while Sarvam is still synthesizing sentence 2/3, instead of the batch
// /text-to-speech route's all-or-nothing wait for the entire clip.
function splitIntoSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]*\s*/g)
  return (parts ?? [text]).map((s) => s.trim()).filter(Boolean)
}

function decodePcm16ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const samples = new Float32Array(bytes.length / 2)
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = view.getInt16(i * 2, true) / 0x8000
  }
  return samples
}

/** Streaming voice-out counterpart to useSpeakReplies' batch playText() - opens
 * a WS straight to backend v1's TTS bridge, streams a reply sentence by
 * sentence, and schedules each returned PCM16 chunk back-to-back on one
 * AudioContext so playback is gapless despite arriving in pieces. Continuous-
 * voice mode only; push-to-talk/batch voice-out is untouched. */
export function useStreamingTTSPlayback() {
  const supported =
    typeof window !== 'undefined' &&
    typeof WebSocket !== 'undefined' &&
    typeof AudioContext !== 'undefined'
  const [speaking, setSpeaking] = useState(false)
  const { toast } = useToast()

  const audioCtxRef = useRef<AudioContext | null>(null)
  const nextStartTimeRef = useRef(0)
  const sourcesRef = useRef<AudioBufferSourceNode[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Survives across reconnects within one speak() call - a mid-reply drop
  // resumes from the next unsent sentence instead of cutting the reply off.
  const sessionRef = useRef<{ sentences: string[]; nextIndex: number; attempts: number } | null>(
    null,
  )
  // A reconnect's setTimeout callback needs to call the latest connect - a
  // ref sidesteps referencing the useCallback-memoized connect before its
  // own declaration finishes (same pattern useStreamingVoice's openSocketRef
  // uses for its 4001 reconnect).
  const connectRef = useRef<() => void>(() => {})

  const scheduleChunk = useCallback((pcm: Float32Array<ArrayBuffer>) => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
      nextStartTimeRef.current = 0
    }
    const ctx = audioCtxRef.current
    const buffer = ctx.createBuffer(1, pcm.length, TTS_SAMPLE_RATE)
    buffer.copyToChannel(pcm, 0)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current)
    source.start(startAt)
    nextStartTimeRef.current = startAt + buffer.duration
    sourcesRef.current.push(source)
    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== source)
    }
  }, [])

  /** Barge-in: stop everything scheduled/playing and close the socket right
   * away - Sarvam's WS has no server-side cancel, so this must be client-side
   * (confirmed against both the fetched docs and Pipecat's own note). Also
   * cancels any pending reconnect so a stale retry can't resume speaking
   * after the user's already moved on. */
  const stopAndFlush = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    sessionRef.current = null
    wsRef.current?.close(1000, 'barge_in')
    wsRef.current = null
    sourcesRef.current.forEach((s) => {
      try {
        s.stop()
      } catch {
        // already stopped/ended
      }
    })
    sourcesRef.current = []
    nextStartTimeRef.current = 0
    setSpeaking(false)
  }, [])

  // Paced, one sentence at a time - only send sentence N+1 once Sarvam's
  // "final" event confirms sentence N was fully synthesized, instead of
  // firing every sentence at connect time. The backend bills by characters
  // actually sent (voice_ws.py's chars_sent), so a barge-in between sentences
  // now means the rest of the reply is never sent to Sarvam at all - not just
  // silenced client-side after being paid for.
  //
  // Reconnects on an unexpected drop (network blip, the 5-minute session TTL,
  // an upstream hiccup) instead of cutting the reply off silently, resuming
  // from whichever sentence hadn't been sent yet - see sessionRef above.
  const connect = useCallback(() => {
    const session = sessionRef.current
    if (!session) return
    const ws = new WebSocket(streamingVoiceWsUrl('/text-to-speech/stream'))
    wsRef.current = ws

    const sendNextSentence = () => {
      const s = sessionRef.current
      if (!s) return
      if (s.nextIndex >= s.sentences.length) {
        ws.close(1000, 'reply_complete')
        return
      }
      const sentence = s.sentences[s.nextIndex]
      s.nextIndex += 1
      ws.send(JSON.stringify({ type: 'text', data: { text: sentence } }))
      ws.send(JSON.stringify({ type: 'flush' }))
    }

    ws.onopen = () => {
      if (sessionRef.current) sessionRef.current.attempts = 0
      sendNextSentence()
    }
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string)
      if (message.type === 'audio' && message.data?.audio) {
        scheduleChunk(decodePcm16ToFloat32(message.data.audio))
      } else if (message.type === 'event' && message.data?.event_type === 'final') {
        sendNextSentence()
      } else if (message.type === 'error') {
        toast(`Voice reply failed: ${message.data?.message ?? 'unknown error'}`, 'error')
      }
    }
    ws.onclose = (event) => {
      if (wsRef.current !== ws) return
      wsRef.current = null
      const current = sessionRef.current
      const finished = !current || current.nextIndex >= current.sentences.length
      if (event.code === 1000 || finished) {
        sessionRef.current = null
        // Let already-scheduled audio finish playing before flipping the
        // indicator off - the socket closing doesn't mean playback is done.
        const remaining = Math.max(0, nextStartTimeRef.current - (audioCtxRef.current?.currentTime ?? 0))
        setTimeout(() => setSpeaking(false), remaining * 1000)
        return
      }
      if (
        event.code === CLOSE_AUTH_FAILED ||
        event.code === CLOSE_RATE_LIMITED ||
        current.attempts >= RECONNECT_MAX_ATTEMPTS
      ) {
        sessionRef.current = null
        toast('Voice reply connection dropped.', 'error')
        setSpeaking(false)
        return
      }
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** current.attempts, RECONNECT_MAX_DELAY_MS)
      current.attempts += 1
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay)
    }
    ws.onerror = () => {
      // onclose always follows onerror for a WebSocket - no duplicate handling here.
    }
  }, [scheduleChunk, toast])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return
      stopAndFlush()
      const sentences = splitIntoSentences(text)
      if (sentences.length === 0) return
      setSpeaking(true)
      sessionRef.current = { sentences, nextIndex: 0, attempts: 0 }
      connect()
    },
    [supported, stopAndFlush, connect],
  )

  return { supported, speaking, speak, stopAndFlush }
}
