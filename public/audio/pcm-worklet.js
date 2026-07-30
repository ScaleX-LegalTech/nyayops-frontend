// AudioWorkletProcessor for continuous-voice capture (Improvements v1 doc
// §3.3/§8.2 item 4). Runs on the audio render thread, not the main thread, so
// it keeps sampling even while React is busy - downsamples whatever rate the
// AudioContext is running at (usually 48kHz) to the 16kHz mono PCM16 Sarvam's
// streaming STT expects, and posts each ~20ms frame to the main thread as a
// transferable ArrayBuffer (no copy) plus a cheap RMS energy reading the main
// thread uses for local barge-in VAD - not the full Sarvam VAD event, which
// only arrives after a network round trip.

const TARGET_SAMPLE_RATE = 16000

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._inputSampleRate = sampleRate // AudioWorkletGlobalScope global
    this._ratio = this._inputSampleRate / TARGET_SAMPLE_RATE
    this._carry = 0
    // Anti-alias low-pass BEFORE decimating - nearest-neighbor sample-picking
    // alone (no filter) let any speech energy above the 16kHz target's
    // Nyquist limit (8kHz - sibilants like "s"/"sh" have plenty) fold back
    // into the audible range as harsh, static-like aliasing noise. A cheap
    // one-pole IIR is enough to meaningfully suppress that; filtering has to
    // happen before picking samples, doing it after is too late.
    const cutoffHz = 7000
    this._lpAlpha = 1 - Math.exp((-2 * Math.PI * cutoffHz) / this._inputSampleRate)
    this._lpState = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel || channel.length === 0) return true

    const filtered = new Float32Array(channel.length)
    let state = this._lpState
    for (let i = 0; i < channel.length; i += 1) {
      state += this._lpAlpha * (channel[i] - state)
      filtered[i] = state
    }
    this._lpState = state

    const outLength = Math.floor((filtered.length + this._carry) / this._ratio)
    if (outLength <= 0) {
      this._carry += filtered.length
      return true
    }
    const pcm16 = new Int16Array(outLength)
    let sumSquares = 0
    let sourceIndex = this._carry > 0 ? this._ratio - this._carry : 0
    for (let i = 0; i < outLength; i += 1) {
      const idx = Math.min(filtered.length - 1, Math.round(sourceIndex))
      const sample = Math.max(-1, Math.min(1, filtered[idx]))
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      sumSquares += sample * sample
      sourceIndex += this._ratio
    }
    this._carry = Math.max(0, sourceIndex - filtered.length)
    const rms = Math.sqrt(sumSquares / outLength)

    this.port.postMessage({ pcm16: pcm16.buffer, rms }, [pcm16.buffer])
    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
