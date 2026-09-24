/**
 * Deed voice — the ElevenLabs Conversational AI session, ported from the
 * Cloudflare Worker's vanilla-JS /chat page (src/worker.js "Voice Widget")
 * so the mic in the composer IS voice (PARITY CP-2 §3) on every surface that
 * mounts the composer, instead of a link back to the legacy shell.
 *
 * Protocol: https://elevenlabs.io/docs/eleven-agents/libraries/web-sockets
 *   server → client: conversation_initiation_metadata | audio | agent_response
 *                    | user_transcript | interruption | ping
 *   client → server: conversation_initiation_client_data | user_audio_chunk
 *                    | pong | contextual_update
 *
 * Nothing here touches React. The composer's hook (useDeedVoice) owns the
 * state; this class owns the audio pipeline and the socket, and reports
 * through callbacks. The signed WebSocket URL is minted by the same Supabase
 * Edge Function the Worker uses, reached through this app's own same-origin
 * proxy (/api/deed/voice) so the browser never learns the function URL and
 * the request works on any origin the app is served from.
 *
 * The free session is capped at ten minutes, exactly as on the Worker: a
 * contextual note to the agent at eight minutes, a hard stop at ten. That is
 * the Investor upsell the session ends on, and it is stated to the customer
 * in the composer, not hidden.
 */

export type VoicePhase = 'idle' | 'requesting-mic' | 'connecting' | 'listening' | 'capped' | 'error'

export interface VoiceTranscriptLine {
  who: 'user' | 'agent'
  text: string
}

export interface VoiceCallbacks {
  onPhase: (phase: VoicePhase, status: string) => void
  onTranscript: (line: VoiceTranscriptLine) => void
}

const SAMPLE_RATE = 16000
const CAP_WARN_MS = 8 * 60 * 1000
const CAP_HARD_MS = 10 * 60 * 1000
const CAP_NOTE =
  'System note: 2 minutes remain in this free session. If it fits naturally, you may mention that BidDeed Investor members ($99/mo) get unlimited conversation time with you, plus reports on every county. Do not interrupt what the user is currently asking.'

type AudioContextCtor = typeof AudioContext

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext || w.webkitAudioContext || null
}

/** Float32 PCM → little-endian PCM16 → base64, the wire format the agent expects. */
export function pcm32ToBase64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let j = 0; j < bytes.byteLength; j++) bin += String.fromCharCode(bytes[j])
  return btoa(bin)
}

/** base64 PCM16 → Float32 samples for an AudioBuffer. */
export function base64ToFloat32(b64: string): Float32Array {
  const raw = atob(b64)
  const view = new DataView(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) view.setUint8(i, raw.charCodeAt(i))
  const out = new Float32Array(Math.floor(raw.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = view.getInt16(i * 2, true) / 32768
  return out
}

export function isRtl(text: string): boolean {
  return /[\u0590-\u08FF]/.test(text)
}

export class DeedVoiceSession {
  private ws: WebSocket | null = null
  private audioCtx: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private stream: MediaStream | null = null
  private queue: string[] = []
  private playing = false
  private active = false
  private capTimer: ReturnType<typeof setTimeout> | null = null
  private readonly signedUrlEndpoint: string

  constructor(
    private readonly cb: VoiceCallbacks,
    signedUrlEndpoint = '/api/deed/voice'
  ) {
    this.signedUrlEndpoint = signedUrlEndpoint
  }

  get isActive(): boolean {
    return this.active
  }

  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || !audioContextCtor()) {
      this.cb.onPhase('error', 'Voice needs a browser with microphone support — use text chat below.')
      return
    }
    this.cb.onPhase('requesting-mic', 'Requesting microphone…')
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      this.stop()
      this.cb.onPhase('error', 'Microphone permission was denied — use text chat below.')
      return
    }

    this.cb.onPhase('connecting', 'Connecting to Deed…')
    let signedUrl: string
    try {
      const res = await fetch(this.signedUrlEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error(`signed-url ${res.status}`)
      const data = (await res.json()) as { signed_url?: string }
      if (!data.signed_url) throw new Error('no signed_url')
      signedUrl = data.signed_url
    } catch {
      this.stop()
      this.cb.onPhase('error', 'Could not connect to voice — try text chat below.')
      return
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(signedUrl)
    } catch {
      this.stop()
      this.cb.onPhase('error', 'Could not open the voice connection — try text chat below.')
      return
    }
    this.ws = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'conversation_initiation_client_data', conversation_config_override: {} }))
    }
    ws.onmessage = (evt) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(String(evt.data)) as Record<string, unknown>
      } catch {
        return
      }
      const t = msg.type
      if (t === 'conversation_initiation_metadata') {
        this.active = true
        this.cb.onPhase('listening', 'Listening — talk to Deed')
        this.startCapTimer()
        this.startMicStream()
      } else if (t === 'ping') {
        const ping = msg.ping_event as { event_id?: number } | undefined
        ws.send(JSON.stringify({ type: 'pong', event_id: ping?.event_id ?? 0 }))
      } else if (t === 'audio') {
        const audio = msg.audio_event as { audio_base_64?: string } | undefined
        if (audio?.audio_base_64) this.enqueue(audio.audio_base_64)
      } else if (t === 'agent_response') {
        const r = msg.agent_response_event as { agent_response?: string } | undefined
        if (r?.agent_response) this.cb.onTranscript({ who: 'agent', text: r.agent_response })
      } else if (t === 'user_transcript') {
        const u = msg.user_transcription_event as { user_transcript?: string } | undefined
        if (u?.user_transcript) this.cb.onTranscript({ who: 'user', text: u.user_transcript })
      } else if (t === 'interruption') {
        this.queue = []
        this.playing = false
      }
    }
    // A socket that never reaches "listening" (a firewall that blocks wss, an
    // expired signed URL, the agent refusing the session) used to be ignored
    // here, so the strip sat on "Connecting to Deed…" for good. It now ends
    // the attempt and says so. A socket this session has already let go of
    // (the customer pressed stop) is not an error.
    ws.onerror = () => {
      if (this.ws !== ws) return
      const wasActive = this.active
      this.stop()
      this.cb.onPhase(
        'error',
        wasActive ? 'Voice connection lost — try text chat below.' : 'Could not connect to voice — try text chat below.'
      )
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      const wasActive = this.active
      this.stop()
      if (wasActive) this.cb.onPhase('idle', '')
      else this.cb.onPhase('error', 'Could not connect to voice — try text chat below.')
    }
  }

  /** Ends the session and releases the microphone. Safe to call twice. */
  stop(): void {
    this.clearCapTimer()
    this.active = false
    this.queue = []
    this.playing = false
    if (this.processor) {
      try {
        this.processor.disconnect()
      } catch {
        /* already gone */
      }
      this.processor = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    const ws = this.ws
    this.ws = null
    if (ws && ws.readyState < 2) ws.close()
  }

  private startMicStream() {
    const Ctor = audioContextCtor()
    if (!Ctor || !this.stream) return
    const ctx = this.audioCtx || new Ctor({ sampleRate: SAMPLE_RATE })
    this.audioCtx = ctx
    const src = ctx.createMediaStreamSource(this.stream)
    // ScriptProcessorNode is deprecated but still the one path that works on
    // every browser the Worker page shipped to; an AudioWorklet port is a
    // follow-up, not a parity requirement.
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    src.connect(processor)
    processor.connect(ctx.destination)
    processor.onaudioprocess = (e) => {
      const ws = this.ws
      if (!this.active || !ws || ws.readyState !== 1) return
      ws.send(JSON.stringify({ user_audio_chunk: pcm32ToBase64(e.inputBuffer.getChannelData(0)) }))
    }
    this.processor = processor
  }

  private enqueue(b64: string) {
    this.queue.push(b64)
    if (!this.playing) this.drain()
  }

  private drain() {
    const next = this.queue.shift()
    if (!next) {
      this.playing = false
      return
    }
    this.playing = true
    const Ctor = audioContextCtor()
    if (!Ctor) return
    const ctx = this.audioCtx || new Ctor({ sampleRate: SAMPLE_RATE })
    this.audioCtx = ctx
    const samples = base64ToFloat32(next)
    const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE)
    buffer.getChannelData(0).set(samples)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    source.onended = () => this.drain()
    source.start()
  }

  private clearCapTimer() {
    if (this.capTimer) clearTimeout(this.capTimer)
    this.capTimer = null
  }

  private startCapTimer() {
    this.clearCapTimer()
    this.capTimer = setTimeout(() => {
      const ws = this.ws
      if (!this.active || !ws || ws.readyState !== 1) return
      ws.send(JSON.stringify({ type: 'contextual_update', text: CAP_NOTE }))
      this.capTimer = setTimeout(() => {
        if (!this.active) return
        this.stop()
        this.cb.onPhase('capped', 'Your free 10-minute voice session has ended.')
      }, CAP_HARD_MS - CAP_WARN_MS)
    }, CAP_WARN_MS)
  }
}
