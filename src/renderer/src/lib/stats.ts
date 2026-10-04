import type { CompletedHistory } from './repo/sessions'
import type { DateKey, LoggedSet, Session } from './types'

/**
 * Personal record rules (also shown in the app):
 *  - Only completed sets with at least 1 rep in finished workouts count.
 *  - Heaviest weight: the most weight on a single set. For bodyweight
 *    exercises this is the most *added* weight.
 *  - Best estimated 1RM (weighted exercises only): Epley formula
 *    weight × (1 + reps ÷ 30), using sets of 1–12 reps. A single rep counts as-is.
 *  - Most reps (bodyweight exercises only): the most reps in a single set.
 *  - A record must beat the previous best; ties do not count. The first session
 *    of an exercise sets the starting point and is not announced as a new record.
 */
export const E1RM_MAX_REPS = 12
const EPSILON = 1e-6

export type RecordType = 'heaviest' | 'e1rm' | 'reps'

export const RECORD_LABELS: Record<RecordType, string> = {
  heaviest: 'Heaviest weight',
  e1rm: 'Best estimated 1RM',
  reps: 'Most reps in a set'
}

export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || reps < 1 || reps > E1RM_MAX_REPS) return null
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30)
}

export interface ExercisePoint {
  sessionId: string
  date: DateKey
  order: number
  setCount: number
  totalReps: number
  bestReps: number
  /** Heaviest weight (kg) on any set, or null when no set carried weight. */
  topWeightKg: number | null
  bestE1rmKg: number | null
  volumeKg: number
}

export interface ExerciseHistory {
  exerciseId: string
  name: string
  muscleGroup: string
  isBodyweight: boolean
  points: ExercisePoint[]
}

export function sortSessionsChronologically<T extends Pick<Session, 'date' | 'startedAt'>>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => (a.date === b.date ? a.startedAt - b.startedAt : a.date.localeCompare(b.date)))
}

function countsForStats(set: LoggedSet): set is LoggedSet & { reps: number } {
  return set.completed && set.reps != null && set.reps >= 1
}

/** Groups completed history per exercise, one chronological point per session. */
export function buildExerciseHistories(history: CompletedHistory): Map<string, ExerciseHistory> {
  const sessions = sortSessionsChronologically(history.sessions.filter((s) => s.status === 'completed'))
  const order = new Map(sessions.map((s, i) => [s.id, i]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const exerciseById = new Map(history.exercises.map((e) => [e.id, e]))
  const result = new Map<string, ExerciseHistory>()
  const pointKey = new Map<string, ExercisePoint>()
  const latestOrder = new Map<string, number>()

  for (const set of history.sets) {
    if (!countsForStats(set)) continue
    const session = sessionById.get(set.sessionId)
    const se = exerciseById.get(set.sessionExerciseId)
    if (!session || !se) continue

    let entry = result.get(se.exerciseId)
    const sessionOrder = order.get(session.id) ?? 0
    if (!entry) {
      entry = { exerciseId: se.exerciseId, name: se.name, muscleGroup: se.muscleGroup, isBodyweight: se.isBodyweight, points: [] }
      result.set(se.exerciseId, entry)
    }
    // The most recent snapshot names the exercise.
    if (sessionOrder >= (latestOrder.get(se.exerciseId) ?? -1)) {
      latestOrder.set(se.exerciseId, sessionOrder)
      entry.name = se.name
      entry.muscleGroup = se.muscleGroup
      entry.isBodyweight = se.isBodyweight
    }

    const key = `${se.exerciseId}|${session.id}`
    let point = pointKey.get(key)
    if (!point) {
      point = { sessionId: session.id, date: session.date, order: sessionOrder, setCount: 0, totalReps: 0, bestReps: 0, topWeightKg: null, bestE1rmKg: null, volumeKg: 0 }
      pointKey.set(key, point)
      entry.points.push(point)
    }
    point.setCount++
    point.totalReps += set.reps
    point.bestReps = Math.max(point.bestReps, set.reps)
    if (set.weightKg != null && set.weightKg > 0) {
      point.topWeightKg = Math.max(point.topWeightKg ?? 0, set.weightKg)
      point.volumeKg += set.weightKg * set.reps
      const e1rm = estimateOneRepMax(set.weightKg, set.reps)
      if (e1rm != null) point.bestE1rmKg = Math.max(point.bestE1rmKg ?? 0, e1rm)
    }
  }

  for (const entry of result.values()) entry.points.sort((a, b) => a.order - b.order)
  return result
}

function recordValue(point: ExercisePoint, type: RecordType, isBodyweight: boolean): number | null {
  if (type === 'heaviest') return point.topWeightKg
  if (type === 'e1rm') return isBodyweight ? null : point.bestE1rmKg
  return isBodyweight ? point.bestReps || null : null
}

export function recordTypesFor(isBodyweight: boolean): RecordType[] {
  return isBodyweight ? ['reps', 'heaviest'] : ['heaviest', 'e1rm']
}

export interface RecordEvent {
  exerciseId: string
  exerciseName: string
  type: RecordType
  value: number
  previous: number
  date: DateKey
  sessionId: string
  order: number
}

export interface CurrentRecord {
  type: RecordType
  value: number
  date: DateKey
  sessionId: string
}

export function computeRecords(histories: Map<string, ExerciseHistory>): {
  events: RecordEvent[]
  current: Map<string, CurrentRecord[]>
} {
  const events: RecordEvent[] = []
  const current = new Map<string, CurrentRecord[]>()
  for (const h of histories.values()) {
    const bests: CurrentRecord[] = []
    for (const type of recordTypesFor(h.isBodyweight)) {
      let best: CurrentRecord | null = null
      for (const point of h.points) {
        const value = recordValue(point, type, h.isBodyweight)
        if (value == null) continue
        if (!best) {
          best = { type, value, date: point.date, sessionId: point.sessionId }
        } else if (value > best.value + EPSILON) {
          events.push({ exerciseId: h.exerciseId, exerciseName: h.name, type, value, previous: best.value, date: point.date, sessionId: point.sessionId, order: point.order })
          best = { type, value, date: point.date, sessionId: point.sessionId }
        }
      }
      if (best) bests.push(best)
    }
    current.set(h.exerciseId, bests)
  }
  events.sort((a, b) => b.order - a.order)
  return { events, current }
}

export interface SessionSummary {
  setCount: number
  exerciseCount: number
  totalReps: number
  volumeKg: number
}

export function summarizeSets(sets: LoggedSet[]): SessionSummary {
  const done = sets.filter(countsForStats)
  return {
    setCount: done.length,
    exerciseCount: new Set(done.map((s) => s.sessionExerciseId)).size,
    totalReps: done.reduce((n, s) => n + s.reps, 0),
    volumeKg: done.reduce((n, s) => n + (s.weightKg ?? 0) * s.reps, 0)
  }
}
