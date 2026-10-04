import { computed, reactive } from 'vue'

/**
 * A single rest timer shared across the app, so it keeps counting while you
 * move between screens. It only runs while the app is open.
 */
const state = reactive({
  durationMs: 90_000,
  remainingMs: 90_000,
  endsAt: null as number | null,
  label: '',
  finishedAt: null as number | null,
  now: Date.now()
})

let ticker: number | null = null
let onFinish: (() => void) | null = null

function tick() {
  state.now = Date.now()
  if (state.endsAt != null && state.now >= state.endsAt) {
    state.endsAt = null
    state.remainingMs = 0
    state.finishedAt = state.now
    onFinish?.()
  }
  if (state.endsAt == null && ticker != null && (state.finishedAt == null || state.now - state.finishedAt > 4000)) {
    window.clearInterval(ticker)
    ticker = null
  }
}

function ensureTicking() {
  if (ticker == null) ticker = window.setInterval(tick, 250)
}

function start(seconds: number, label = '') {
  state.durationMs = Math.max(0, seconds) * 1000
  state.remainingMs = state.durationMs
  state.label = label
  state.finishedAt = null
  state.now = Date.now()
  state.endsAt = state.durationMs > 0 ? state.now + state.durationMs : null
  ensureTicking()
}

function pause() {
  if (state.endsAt == null) return
  state.remainingMs = Math.max(0, state.endsAt - Date.now())
  state.endsAt = null
}

function resume() {
  if (state.endsAt != null || state.remainingMs <= 0) return
  state.finishedAt = null
  state.now = Date.now()
  state.endsAt = state.now + state.remainingMs
  ensureTicking()
}

function reset() {
  state.endsAt = null
  state.finishedAt = null
  state.remainingMs = state.durationMs
}

function adjust(seconds: number) {
  const delta = seconds * 1000
  if (state.endsAt != null) {
    state.endsAt = Math.max(Date.now(), state.endsAt + delta)
    state.durationMs = Math.max(0, state.durationMs + delta)
  } else {
    state.remainingMs = Math.max(0, state.remainingMs + delta)
    state.durationMs = Math.max(state.remainingMs, state.durationMs + delta)
  }
}

export function useRestTimer() {
  const running = computed(() => state.endsAt != null)
  const remainingSeconds = computed(() =>
    state.endsAt != null ? Math.max(0, (state.endsAt - state.now) / 1000) : state.remainingMs / 1000
  )
  const progress = computed(() => (state.durationMs > 0 ? 1 - (remainingSeconds.value * 1000) / state.durationMs : 0))
  const justFinished = computed(() => state.finishedAt != null && state.now - state.finishedAt < 4000)
  return {
    state,
    running,
    remainingSeconds,
    progress,
    justFinished,
    start,
    pause,
    resume,
    reset,
    adjust,
    onFinish: (fn: (() => void) | null) => {
      onFinish = fn
    }
  }
}

/** A short two-note chime generated locally (no audio files, works offline). */
export function playChime() {
  try {
    const ctx = new AudioContext()
    const notes = [880, 1320]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.16
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.06, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.15)
    })
    setTimeout(() => void ctx.close(), 600)
  } catch {
    // Audio is a nicety; ignore failures.
  }
}
