import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import {
  CLOSE_AUTH_FAILED,
  CLOSE_RATE_LIMITED,
  CLOSE_SESSION_EXPIRED,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_MAX_DELAY_MS,
  streamingVoiceWsUrl,
} from './streamingVoiceWs'

// After stop() is clicked: wait this long after the LAST transcript update
// before finalizing (a blind fixed delay cut off trailing words whenever
// Sarvam's flushed final segment took longer than that fixed window to land -
// this instead keeps extending the wait as long as new text keeps arriving).
const FINALIZE_DEBOUNCE_MS = 500
// Once Sarvam's own STOP_SPEECH confirms the utterance is actually done,
// there's no need to wait the full debounce - just long enough for any
// already-in-flight transcript update for that segment to land.
const FINALIZE_QUICK_MS = 150
// Absolute cap from the stop() click, regardless of how much activity keeps
// resetting the debounce - so a runaway stream of updates can't delay sending
// forever.
const FINALIZE_MAX_WAIT_MS = 3000

// How often the waveform-facing audioLevel state updates from the worklet's
// per-frame RMS - frames arrive every ~2.7ms (one 128-sample render quantum
// at 48kHz), far too fast to push through React state without hammering
// re-renders; this samples the (already-smoothed) level a few times a second
// instead, still fast enough to read as live.
const LEVEL_SAMPLE_INTERVAL_MS = 80
// Maps typical speech RMS (roughly 0.02-0.15 on the -1..1 float samples the
// worklet computes it from - the same range the old local-VAD threshold used)
// into a visually useful 0-1 range for the waveform bars. A rough default,
// not calibrated against a live mic - tune if speech reads as too
// quiet/loud on the bars in practice.
const LEVEL_SCALE = 8

function pcm16ToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Push-to-talk speech input over backend v1's streaming STT bridge - same
 * start-while-held/click, stop-to-send shape as useSpeechInput, just fast
 * (streams 16kHz PCM16 to Sarvam over a WebSocket instead of recording a
 * whole clip and uploading it after the fact). Turn boundaries for SENDING are
 * manual only (start()/stop()) - no local energy-VAD, no auto-finalize-on-
 * silence-triggered-send, no barge-in; a continuous/VAD-driven version of this
 * was tried and rolled back for disturbing the plain click-to-talk flow.
 *
 * Sarvam's own vad_signals STOP_SPEECH is still watched, but only to COMMIT
 * text, never to send it: Sarvam's `data.transcript` is the running hypothesis
 * for its CURRENT internal utterance only and resets to empty the moment it
 * decides a new utterance started (any natural mid-sentence pause) - ignoring
 * that reset (as an earlier version of this hook did) silently dropped
 * everything said before the last pause. committedRef accumulates each
 * completed utterance; the displayed/sent transcript is committed + the live
 * one.
 *
 * finalizingRef is the ONE re-entrancy guard for stop() - checked and set
 * synchronously (a plain ref, not React state, which doesn't update until the
 * next render and so can't reliably block a second call arriving before that
 * render happens, however it's triggered). Every place that can end up
 * calling onFinalTranscript goes through finalizeAndSend, and
 * finalizeAndSend/scheduleFinalize are the only writers of finalizingRef. */
export function useStreamingVoice(onFinalTranscript: (text: string) => void) {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioWorkletNode !== 'undefined' &&
    typeof WebSocket !== 'undefined'

  const [status, setStatus] = useState<'idle' | 'starting' | 'recording' | 'transcribing'>('idle')
  const [partialTranscript, setPartialTranscript] = useState('')
  // Real mic input level (0-1), for the waveform to actually reflect - not
  // decorative. Backs the "is my voice even getting picked up" feedback the
  // old CSS-only animation couldn't give (it played the same canned motion
  // whether or not the mic was hearing anything).
  const [audioLevel, setAudioLevel] = useState(0)

  const { toast } = useToast()
  const onFinalRef = useRef(onFinalTranscript)
  useEffect(() => {
    onFinalRef.current = onFinalTranscript
  })

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const shouldReconnectRef = useRef(false)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalizingRef = useRef(false)
  const stopClickedAtRef = useRef(0)
  // Audio captured before the WS is OPEN (the initial 3-hop handshake, or a
  // mid-recording reconnect) - the worklet starts posting frames the instant
  // the mic is live, well before the connection finishes, so without
  // buffering here whatever was said in that window is silently never sent
  // to Sarvam at all. That reads as "only the last few words" for anyone who
  // starts talking right after clicking the mic - a real bug no amount of
  // transcript-side accumulation logic could ever have caught, since Sarvam
  // never received the audio to begin with.
  const pendingAudioRef = useRef<string[]>([])
  // Smoothed (EMA) raw RMS, updated every worklet frame - audioLevel state is
  // sampled from this on a timer rather than on every frame, see
  // LEVEL_SAMPLE_INTERVAL_MS above.
  const smoothedLevelRef = useRef(0)
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Completed-utterance text (joined with a space) and the current
  // in-progress utterance - see the doc comment above for why both are needed.
  const committedRef = useRef('')
  const liveRef = useRef('')

  const joinCommittedAndLive = useCallback(() => {
    const committed = committedRef.current
    const live = liveRef.current
    return committed && live ? `${committed} ${live}` : committed || live
  }, [])

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const clearFinalizeTimer = useCallback(() => {
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current)
      finalizeTimerRef.current = null
    }
  }, [])

  const teardown = useCallback(() => {
    clearReconnectTimer()
    clearFinalizeTimer()
    reconnectAttemptsRef.current = 0
    finalizingRef.current = false
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current)
      levelTimerRef.current = null
    }
    smoothedLevelRef.current = 0
    setAudioLevel(0)
    if (wsRef.current) {
      wsRef.current.close(1000, 'stopped')
      wsRef.current = null
    }
    workletRef.current?.disconnect()
    workletRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    // audioCtxRef is deliberately left alone here - see start()'s comment on
    // why it's reused across recordings instead of recreated. The mic stream
    // itself still gets fully released above, so the browser's mic-in-use
    // indicator still correctly turns off between recordings.
    committedRef.current = ''
    liveRef.current = ''
    pendingAudioRef.current = []
    setStatus('idle')
  }, [clearReconnectTimer, clearFinalizeTimer])

  /** Stops recording and throws the clip away - no transcript is sent. Mirrors
   * useSpeechInput's cancel(). */
  const cancel = useCallback(() => {
    shouldReconnectRef.current = false
    setPartialTranscript('')
    teardown()
  }, [teardown])

  useEffect(() => cancel, [cancel])

  // teardown() (called by cancel/finalizeAndSend, i.e. on every recording end)
  // deliberately does NOT close audioCtxRef - it's reused across recordings.
  // This is the one place it actually gets closed, when the component using
  // this hook unmounts for good.
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close()
      }
      audioCtxRef.current = null
    }
  }, [])

  /** The only place that ever calls onFinalTranscript - reachable solely via
   * scheduleFinalize's timer, which is itself only ever armed from stop()
   * while finalizingRef is true. Despite the name, this no longer sends the
   * message itself (Q47 fix) - the caller (useAskNyayOpsChat's
   * receiveVoiceTranscript) fills the input box for review instead. */
  const finalizeAndSend = useCallback(() => {
    clearFinalizeTimer()
    finalizingRef.current = false
    shouldReconnectRef.current = false
    const text = joinCommittedAndLive().trim()
    if (text) onFinalRef.current(text)
    else toast("Didn't catch that - try speaking a bit longer.", 'info')
    setPartialTranscript('')
    teardown()
  }, [clearFinalizeTimer, joinCommittedAndLive, teardown, toast])

  /** (Re)arms the finalize timer, capped so repeated activity can't push the
   * actual send past FINALIZE_MAX_WAIT_MS from the original stop() click. */
  const scheduleFinalize = useCallback(
    (delay: number) => {
      clearFinalizeTimer()
      const elapsed = Date.now() - stopClickedAtRef.current
      const remaining = Math.max(0, FINALIZE_MAX_WAIT_MS - elapsed)
      finalizeTimerRef.current = setTimeout(finalizeAndSend, Math.min(delay, remaining))
    },
    [clearFinalizeTimer, finalizeAndSend],
  )

  // Self-reconnect (4001/session_expired, or a transient drop) calls back
  // into openSocket from its own ws.onclose - a ref sidesteps referencing the
  // useCallback-memoized openSocket before its own declaration finishes.
  const openSocketRef = useRef<() => void>(() => {})

  const openSocket = useCallback(() => {
    const ws = new WebSocket(streamingVoiceWsUrl('/speech-to-text/stream'))
    wsRef.current = ws
    ws.onopen = () => {
      reconnectAttemptsRef.current = 0
      // status is already 'recording' by this point - see start()'s comment
      // on why it no longer waits for the WS to open.
      // Send whatever the worklet captured while this connection (or a prior
      // one, on reconnect) was still opening - see pendingAudioRef's doc
      // comment above.
      for (const chunk of pendingAudioRef.current) {
        ws.send(JSON.stringify({ audio: { data: chunk } }))
      }
      pendingAudioRef.current = []
    }
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data as string)
      if (message.type === 'data' && typeof message.data?.transcript === 'string') {
        liveRef.current = message.data.transcript
        setPartialTranscript(joinCommittedAndLive())
        // More text just arrived while waiting to finalize - push the
        // deadline back out instead of cutting it off mid-word.
        if (finalizingRef.current) scheduleFinalize(FINALIZE_DEBOUNCE_MS)
      } else if (message.type === 'events' && message.data?.event_type === 'vad_event') {
        if (message.data.signal_type === 'STOP_SPEECH' && liveRef.current) {
          // Sarvam is about to reset its own running transcript for the next
          // utterance - commit what it just gave us before that happens.
          committedRef.current = joinCommittedAndLive()
          liveRef.current = ''
          // A strong "this utterance is done" signal - finalize soon rather
          // than waiting out the full debounce.
          if (finalizingRef.current) scheduleFinalize(FINALIZE_QUICK_MS)
        }
      } else if (message.type === 'error') {
        toast(`Voice input error: ${message.data?.message ?? 'unknown error'}`, 'error')
      }
    }
    ws.onclose = (event) => {
      if (wsRef.current !== ws) return
      wsRef.current = null
      if (!shouldReconnectRef.current) return
      if (event.code === CLOSE_SESSION_EXPIRED) {
        // Routine 5-minute session rollover - reconnect right away, no backoff.
        openSocketRef.current()
        return
      }
      if (event.code === CLOSE_AUTH_FAILED) {
        // Access token expired/invalid mid-session - reconnecting would just
        // fail again with the same token; a fresh sign-in is what actually
        // fixes it.
        toast('Voice input needs you to sign in again.', 'error')
        cancel()
        return
      }
      if (event.code === CLOSE_RATE_LIMITED) {
        // ask_nyayops_burst_limit_per_minute (default 15/min) or the daily
        // voice usage guard tripped - retrying immediately just gets
        // rate-limited again.
        toast("You've sent a lot of voice messages quickly - wait a moment and try again.", 'error')
        cancel()
        return
      }
      // Unexpected drop (network blip, dev-server restart, upstream hiccup) -
      // resume instead of ending the whole recording on one bad frame. Only
      // give up once retries are exhausted.
      if (reconnectAttemptsRef.current >= RECONNECT_MAX_ATTEMPTS) {
        toast('Voice input connection dropped - check your network and try again.', 'error')
        cancel()
        return
      }
      const delay = Math.min(
        RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttemptsRef.current,
        RECONNECT_MAX_DELAY_MS,
      )
      reconnectAttemptsRef.current += 1
      reconnectTimerRef.current = setTimeout(() => openSocketRef.current(), delay)
    }
  }, [toast, cancel, joinCommittedAndLive, scheduleFinalize])

  useEffect(() => {
    openSocketRef.current = openSocket
  }, [openSocket])

  const start = useCallback(async () => {
    if (!supported || status !== 'idle') return
    setStatus('starting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      toast("Couldn't access the microphone - check your browser's permission for this site.", 'error')
      setStatus('idle')
      return
    }
    streamRef.current = stream

    // Reused across recordings, not recreated per click - a fresh
    // AudioContext needs its own audioWorklet.addModule() call (network
    // fetch + compile + register, scoped per BaseAudioContext instance, not
    // shareable across separate AudioContexts), which was real, repeated
    // latency between clicking the mic and it actually starting to record.
    // Only pay that cost once, on the very first use.
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      try {
        const audioCtx = new AudioContext()
        await audioCtx.audioWorklet.addModule('/audio/pcm-worklet.js')
        audioCtxRef.current = audioCtx
      } catch {
        audioCtxRef.current = null
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        toast("Couldn't set up voice input - try again.", 'error')
        setStatus('idle')
        return
      }
    } else if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume()
    }
    const audioCtx = audioCtxRef.current

    const source = audioCtx.createMediaStreamSource(stream)
    const worklet = new AudioWorkletNode(audioCtx, 'pcm-capture-processor')
    workletRef.current = worklet
    source.connect(worklet)

    setPartialTranscript('')
    committedRef.current = ''
    liveRef.current = ''
    finalizingRef.current = false
    pendingAudioRef.current = []
    smoothedLevelRef.current = 0
    setAudioLevel(0)
    shouldReconnectRef.current = true
    // The local mic pipeline is live now - audio capture (and buffering, if
    // the WS isn't open yet - see pendingAudioRef) already started, so there
    // is no real reason to make the user wait out the WS handshake before
    // the UI shows them as recording.
    setStatus('recording')
    openSocket()

    worklet.port.onmessage = (event: MessageEvent<{ pcm16: ArrayBuffer; rms: number }>) => {
      // Light exponential smoothing so the waveform doesn't jitter frame to
      // frame - still reacts fast enough to read as live, not laggy.
      smoothedLevelRef.current = smoothedLevelRef.current * 0.7 + event.data.rms * 0.3
      const chunk = pcm16ToBase64(event.data.pcm16)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ audio: { data: chunk } }))
      } else {
        // Not open yet (initial handshake) or mid-reconnect - buffer instead
        // of dropping; ws.onopen flushes this the moment the connection is
        // actually ready.
        pendingAudioRef.current.push(chunk)
      }
    }

    // Starts immediately (mic is live now, well before the WS necessarily
    // is) so the waveform confirms the mic itself is picking something up
    // even during the handshake window - independent of whether the STT
    // pipeline is ready yet.
    levelTimerRef.current = setInterval(() => {
      setAudioLevel(Math.min(1, smoothedLevelRef.current * LEVEL_SCALE))
    }, LEVEL_SAMPLE_INTERVAL_MS)
  }, [supported, status, openSocket, toast])

  /** Stops recording and hands off whatever was transcribed via
   * onFinalTranscript - the manual equivalent of useSpeechInput's stop().
   * Flushes Sarvam's buffered audio, then waits for transcript activity to
   * settle (see FINALIZE_* above) before finalizing with whatever's
   * accumulated.
   *
   * finalizingRef is set synchronously as the very first thing, before
   * anything else - the `status !== 'recording'` check alone can't stop a
   * double click/tap from sending the same turn twice, since React state
   * updates aren't visible until the next render: two clicks dispatched
   * before that render both see the stale 'recording' status. A plain ref
   * updates immediately, so the second call sees finalizingRef already true
   * and bails out regardless of why/how it was triggered twice. */
  const stop = useCallback(() => {
    if (status !== 'recording' || finalizingRef.current) return
    finalizingRef.current = true
    stopClickedAtRef.current = Date.now()
    setStatus('transcribing')
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'flush' }))
    }
    scheduleFinalize(FINALIZE_DEBOUNCE_MS)
  }, [status, scheduleFinalize])

  return { supported, status, partialTranscript, audioLevel, start, stop, cancel }
}
