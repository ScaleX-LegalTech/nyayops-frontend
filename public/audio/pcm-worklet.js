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
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel || channel.length === 0) return true

    const outLength = Math.floor((channel.length + this._carry) / this._ratio)
    if (outLength <= 0) {
      this._carry += channel.length
      return true
    }
    const pcm16 = new Int16Array(outLength)
    let sumSquares = 0
    let sourceIndex = this._carry > 0 ? this._ratio - this._carry : 0
    for (let i = 0; i < outLength; i += 1) {
      const idx = Math.min(channel.length - 1, Math.round(sourceIndex))
      const sample = Math.max(-1, Math.min(1, channel[idx]))
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      sumSquares += sample * sample
      sourceIndex += this._ratio
    }
    this._carry = Math.max(0, sourceIndex - channel.length)
    const rms = Math.sqrt(sumSquares / outLength)

    this.port.postMessage({ pcm16: pcm16.buffer, rms }, [pcm16.buffer])
    return true
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
