import { db } from '../db'
import { isDateKey, todayKey } from '../dates'
import { isBodyweightEquipment, type DateKey, type LoggedSet, type Session, type SessionExercise } from '../types'
import { MAX_REPS, MAX_WEIGHT_KG } from '../units'
import { newId } from '../utils'

export interface SessionExerciseWithSets extends SessionExercise {
  sets: LoggedSet[]
}

export interface SessionDetail {
  session: Session
  exercises: SessionExerciseWithSets[]
}

export interface PreviousPerformance {
  sessionId: string
  date: DateKey
  sets: Array<{ reps: number; weightKg: number | null }>
}

const sessionTables = [db.sessions, db.sessionExercises, db.loggedSets]

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first()
}

export async function loadSessionDetail(id: string): Promise<SessionDetail | undefined> {
  const session = await db.sessions.get(id)
  if (!session) return undefined
  const [exercises, sets] = await Promise.all([
    db.sessionExercises.where('sessionId').equals(id).toArray(),
    db.loggedSets.where('sessionId').equals(id).toArray()
  ])
  return {
    session,
    exercises: exercises
      .sort((a, b) => a.position - b.position)
      .map((ex) => ({
        ...ex,
        sets: sets.filter((s) => s.sessionExerciseId === ex.id).sort((a, b) => a.position - b.position)
      }))
  }
}

function blankSet(sessionExercise: SessionExercise, position: number, weightKg: number | null = null): LoggedSet {
  return {
    id: newId(),
    sessionId: sessionExercise.sessionId,
    sessionExerciseId: sessionExercise.id,
    exerciseId: sessionExercise.exerciseId,
    position,
    reps: null,
    weightKg,
    completed: false,
    completedAt: null
  }
}

/**
 * Starts a workout, optionally from a routine. Only one workout can be active;
 * if one already exists it is returned instead so it can be resumed.
 */
export async function startSession(options: { routineId?: string | null; date?: DateKey } = {}): Promise<{ id: string; resumed: boolean }> {
  const date = options.date ?? todayKey()
  if (!isDateKey(date)) throw new Error('Invalid workout date.')
  return db.transaction('rw', [...sessionTables, db.routines, db.routineExercises, db.exercises], async () => {
    const existing = await db.sessions.where('status').equals('active').first()
    if (existing) return { id: existing.id, resumed: true }

    const now = Date.now()
    const routine = options.routineId ? await db.routines.get(options.routineId) : undefined
    if (options.routineId && !routine) throw new Error('That routine no longer exists.')

    const session: Session = {
      id: newId(),
      date,
      status: 'active',
      routineId: routine?.id ?? null,
      routineName: routine?.name ?? 'Free workout',
      notes: '',
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now
    }
    await db.sessions.add(session)

    if (routine) {
      const items = (await db.routineExercises.where('routineId').equals(routine.id).toArray()).sort((a, b) => a.position - b.position)
      const exercises = await db.exercises.bulkGet(items.map((i) => i.exerciseId))
      const sessionExercises: SessionExercise[] = []
      const sets: LoggedSet[] = []
      items.forEach((item, index) => {
        const exercise = exercises[index]
        if (!exercise) return
        const se: SessionExercise = {
          id: newId(),
          sessionId: session.id,
          exerciseId: exercise.id,
          position: sessionExercises.length,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          equipment: exercise.equipment,
          isBodyweight: isBodyweightEquipment(exercise.equipment),
          targetSets: item.targetSets,
          repMin: item.repMin,
          repMax: item.repMax,
          targetWeightKg: item.targetWeightKg,
          restSeconds: item.restSeconds
        }
        sessionExercises.push(se)
        for (let i = 0; i < item.targetSets; i++) sets.push(blankSet(se, i))
      })
      await db.sessionExercises.bulkAdd(sessionExercises)
      await db.loggedSets.bulkAdd(sets)
    }
    return { id: session.id, resumed: false }
  })
}

async function touchSession(sessionId: string) {
  await db.sessions.update(sessionId, { updatedAt: Date.now() })
}

export async function addExerciseToSession(sessionId: string, exerciseId: string, restSeconds: number): Promise<void> {
  await db.transaction('rw', [...sessionTables, db.exercises], async () => {
    const exercise = await db.exercises.get(exerciseId)
    if (!exercise) throw new Error('That exercise no longer exists.')
    const count = await db.sessionExercises.where('sessionId').equals(sessionId).count()
    const positions = (await db.sessionExercises.where('sessionId').equals(sessionId).toArray()).map((e) => e.position)
    const se: SessionExercise = {
      id: newId(),
      sessionId,
      exerciseId,
      position: count ? Math.max(...positions) + 1 : 0,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment,
      isBodyweight: isBodyweightEquipment(exercise.equipment),
      targetSets: null,
      repMin: null,
      repMax: null,
      targetWeightKg: null,
      restSeconds
    }
    await db.sessionExercises.add(se)
    await db.loggedSets.add(blankSet(se, 0))
    await touchSession(sessionId)
  })
}

export async function removeSessionExercise(sessionExerciseId: string): Promise<void> {
  await db.transaction('rw', sessionTables, async () => {
    const se = await db.sessionExercises.get(sessionExerciseId)
    if (!se) return
    await db.loggedSets.where('sessionExerciseId').equals(sessionExerciseId).delete()
    await db.sessionExercises.delete(sessionExerciseId)
    await touchSession(se.sessionId)
  })
}

/** Adds a set, carrying over the weight of the previous set to save typing. */
export async function addSet(sessionExerciseId: string): Promise<string> {
  return db.transaction('rw', sessionTables, async () => {
    const se = await db.sessionExercises.get(sessionExerciseId)
    if (!se) throw new Error('That exercise is no longer in this workout.')
    const sets = (await db.loggedSets.where('sessionExerciseId').equals(sessionExerciseId).toArray()).sort((a, b) => a.position - b.position)
    const last = sets[sets.length - 1]
    const set = blankSet(se, last ? last.position + 1 : 0, last?.weightKg ?? null)
    await db.loggedSets.add(set)
    await touchSession(se.sessionId)
    return set.id
  })
}

export async function removeSet(setId: string): Promise<void> {
  await db.transaction('rw', sessionTables, async () => {
    const set = await db.loggedSets.get(setId)
    if (!set) return
    await db.loggedSets.delete(setId)
    await touchSession(set.sessionId)
  })
}

function assertSetValues(reps: number | null | undefined, weightKg: number | null | undefined) {
  if (reps != null && (!Number.isInteger(reps) || reps < 0 || reps > MAX_REPS)) throw new Error('Reps are out of range.')
  if (weightKg != null && (!Number.isFinite(weightKg) || weightKg < 0 || weightKg > MAX_WEIGHT_KG)) {
    throw new Error('Weight is out of range.')
  }
}

export async function updateSet(setId: string, patch: Partial<Pick<LoggedSet, 'reps' | 'weightKg' | 'completed'>>): Promise<void> {
  assertSetValues(patch.reps, patch.weightKg)
  await db.transaction('rw', sessionTables, async () => {
    const set = await db.loggedSets.get(setId)
    if (!set) return
    const changes: Partial<LoggedSet> = { ...patch }
    if (patch.completed !== undefined) changes.completedAt = patch.completed ? Date.now() : null
    await db.loggedSets.update(setId, changes)
    await touchSession(set.sessionId)
  })
}

export async function updateSessionNotes(sessionId: string, notes: string): Promise<void> {
  await db.sessions.update(sessionId, { notes: notes.slice(0, 4000), updatedAt: Date.now() })
}

/**
 * Completes a workout. Sets that were never marked complete are removed, as
 * are exercises left without any completed set.
 */
export async function finishSession(sessionId: string): Promise<{ removedSets: number }> {
  return db.transaction('rw', sessionTables, async () => {
    const session = await db.sessions.get(sessionId)
    if (!session) throw new Error('That workout no longer exists.')
    if (session.status !== 'active') return { removedSets: 0 }
    const sets = await db.loggedSets.where('sessionId').equals(sessionId).toArray()
    const keep = sets.filter((s) => s.completed && s.reps != null && s.reps > 0)
    if (!keep.length) throw new Error('Complete at least one set before finishing, or discard the workout.')
    const removed = sets.filter((s) => !keep.includes(s))
    await db.loggedSets.bulkDelete(removed.map((s) => s.id))
    const usedExerciseIds = new Set(keep.map((s) => s.sessionExerciseId))
    const exercises = await db.sessionExercises.where('sessionId').equals(sessionId).toArray()
    await db.sessionExercises.bulkDelete(exercises.filter((e) => !usedExerciseIds.has(e.id)).map((e) => e.id))
    const now = Date.now()
    await db.sessions.update(sessionId, { status: 'completed', finishedAt: now, updatedAt: now })
    return { removedSets: removed.length }
  })
}

/** Deletes a session and everything logged in it. Used for discarding and deleting. */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', sessionTables, async () => {
    await db.loggedSets.where('sessionId').equals(sessionId).delete()
    await db.sessionExercises.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

/** The most recent completed session that included this exercise. */
export async function getPreviousPerformance(exerciseId: string, excludeSessionId?: string): Promise<PreviousPerformance | null> {
  const entries = await db.sessionExercises.where('exerciseId').equals(exerciseId).toArray()
  const sessionIds = [...new Set(entries.map((e) => e.sessionId))].filter((id) => id !== excludeSessionId)
  if (!sessionIds.length) return null
  const sessions = (await db.sessions.bulkGet(sessionIds)).filter((s): s is Session => !!s && s.status === 'completed')
  if (!sessions.length) return null
  sessions.sort((a, b) => (a.date === b.date ? (b.finishedAt ?? 0) - (a.finishedAt ?? 0) : b.date.localeCompare(a.date)))
  const latest = sessions[0]
  const seIds = new Set(entries.filter((e) => e.sessionId === latest.id).map((e) => e.id))
  const sets = (await db.loggedSets.where('sessionId').equals(latest.id).toArray())
    .filter((s) => seIds.has(s.sessionExerciseId) && s.completed && s.reps != null)
    .sort((a, b) => a.position - b.position)
  return { sessionId: latest.id, date: latest.date, sets: sets.map((s) => ({ reps: s.reps!, weightKg: s.weightKg })) }
}

export interface SessionCorrection {
  date: DateKey
  notes: string
  exercises: Array<{
    id: string
    sets: Array<{ id?: string; reps: number; weightKg: number | null }>
  }>
}

export function validateCorrection(correction: SessionCorrection, bodyweightIds: Set<string>): string[] {
  const errors: string[] = []
  if (!isDateKey(correction.date)) errors.push('Pick a valid date.')
  if (correction.date > todayKey()) errors.push('The workout date cannot be in the future.')
  let total = 0
  for (const ex of correction.exercises) {
    for (const set of ex.sets) {
      total++
      if (!Number.isInteger(set.reps) || set.reps < 1 || set.reps > MAX_REPS) errors.push('Every set needs at least 1 rep.')
      if (set.weightKg == null && !bodyweightIds.has(ex.id)) errors.push('Weighted exercises need a weight on every set.')
      if (set.weightKg != null && (set.weightKg < 0 || set.weightKg > MAX_WEIGHT_KG)) errors.push('A weight is out of range.')
    }
  }
  if (total === 0) errors.push('A completed workout needs at least one set. Delete the workout instead.')
  return [...new Set(errors)]
}

/** Replaces the logged sets of a completed session with corrected values. */
export async function saveSessionCorrection(sessionId: string, correction: SessionCorrection): Promise<void> {
  await db.transaction('rw', sessionTables, async () => {
    const detail = await loadSessionDetail(sessionId)
    if (!detail) throw new Error('That workout no longer exists.')
    const bodyweightIds = new Set(detail.exercises.filter((e) => e.isBodyweight).map((e) => e.id))
    const errors = validateCorrection(correction, bodyweightIds)
    if (errors.length) throw new Error(errors[0])

    const keepIds = new Set(correction.exercises.filter((e) => e.sets.length).map((e) => e.id))
    const dropped = detail.exercises.filter((e) => !keepIds.has(e.id)).map((e) => e.id)
    await db.sessionExercises.bulkDelete(dropped)
    await db.loggedSets.where('sessionId').equals(sessionId).delete()

    const now = Date.now()
    const rows: LoggedSet[] = []
    for (const ex of correction.exercises) {
      const original = detail.exercises.find((e) => e.id === ex.id)
      if (!original || !ex.sets.length) continue
      ex.sets.forEach((set, position) => {
        const previous = original.sets.find((s) => s.id === set.id)
        rows.push({
          id: set.id ?? newId(),
          sessionId,
          sessionExerciseId: ex.id,
          exerciseId: original.exerciseId,
          position,
          reps: set.reps,
          weightKg: set.weightKg,
          completed: true,
          completedAt: previous?.completedAt ?? now
        })
      })
    }
    await db.loggedSets.bulkAdd(rows)
    await db.sessions.update(sessionId, { date: correction.date, notes: correction.notes.trim().slice(0, 4000), updatedAt: now })
  })
}

export interface CompletedHistory {
  sessions: Session[]
  exercises: SessionExercise[]
  sets: LoggedSet[]
}

export async function loadCompletedHistory(): Promise<CompletedHistory> {
  const sessions = await db.sessions.where('status').equals('completed').toArray()
  const ids = sessions.map((s) => s.id)
  const [exercises, sets] = await Promise.all([
    db.sessionExercises.where('sessionId').anyOf(ids).toArray(),
    db.loggedSets.where('sessionId').anyOf(ids).toArray()
  ])
  return { sessions, exercises, sets }
}
