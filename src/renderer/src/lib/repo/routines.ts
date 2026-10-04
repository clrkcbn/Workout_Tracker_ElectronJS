import { db } from '../db'
import type { Exercise, Routine, RoutineExercise } from '../types'
import { MAX_WEIGHT_KG } from '../units'
import { newId } from '../utils'

export interface RoutineItemDraft {
  /** Existing routine-exercise id, or undefined for newly added rows. */
  id?: string
  exerciseId: string
  targetSets: number
  repMin: number
  repMax: number
  targetWeightKg: number | null
  restSeconds: number
}

export interface RoutineDraft {
  name: string
  notes: string
  items: RoutineItemDraft[]
}

export interface RoutineSummary extends Routine {
  items: Array<RoutineExercise & { exercise: Exercise | undefined }>
}

export function validateRoutineDraft(draft: RoutineDraft): string[] {
  const errors: string[] = []
  const name = draft.name.trim()
  if (!name) errors.push('Give the routine a name.')
  if (name.length > 80) errors.push('Keep the routine name under 80 characters.')
  draft.items.forEach((item, index) => {
    const label = `Exercise ${index + 1}`
    if (!Number.isInteger(item.targetSets) || item.targetSets < 1 || item.targetSets > 20) {
      errors.push(`${label}: sets must be a whole number from 1 to 20.`)
    }
    if (!Number.isInteger(item.repMin) || item.repMin < 1 || item.repMin > 100) {
      errors.push(`${label}: minimum reps must be from 1 to 100.`)
    }
    if (!Number.isInteger(item.repMax) || item.repMax < item.repMin || item.repMax > 100) {
      errors.push(`${label}: maximum reps must be at least the minimum (and at most 100).`)
    }
    if (item.targetWeightKg != null && (item.targetWeightKg < 0 || item.targetWeightKg > MAX_WEIGHT_KG)) {
      errors.push(`${label}: target weight is out of range.`)
    }
    if (!Number.isInteger(item.restSeconds) || item.restSeconds < 0 || item.restSeconds > 1800) {
      errors.push(`${label}: rest must be between 0 seconds and 30 minutes.`)
    }
  })
  return errors
}

export async function listRoutines(): Promise<RoutineSummary[]> {
  const [routines, items, exercises] = await Promise.all([
    db.routines.toArray(),
    db.routineExercises.toArray(),
    db.exercises.toArray()
  ])
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  return routines
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((routine) => ({
      ...routine,
      items: items
        .filter((i) => i.routineId === routine.id)
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ ...i, exercise: exerciseById.get(i.exerciseId) }))
    }))
}

export async function getRoutine(id: string): Promise<RoutineSummary | undefined> {
  const routine = await db.routines.get(id)
  if (!routine) return undefined
  const items = (await db.routineExercises.where('routineId').equals(id).toArray()).sort((a, b) => a.position - b.position)
  const exercises = await db.exercises.bulkGet(items.map((i) => i.exerciseId))
  return { ...routine, items: items.map((i, idx) => ({ ...i, exercise: exercises[idx] })) }
}

/** Creates or replaces a routine and its ordered exercise list in one transaction. */
export async function saveRoutine(id: string | null, draft: RoutineDraft): Promise<string> {
  const errors = validateRoutineDraft(draft)
  if (errors.length) throw new Error(errors[0])
  return db.transaction('rw', db.routines, db.routineExercises, db.exercises, async () => {
    const now = Date.now()
    const routineId = id ?? newId()
    const existing = id ? await db.routines.get(id) : undefined
    if (id && !existing) throw new Error('That routine no longer exists.')

    const exerciseIds = [...new Set(draft.items.map((i) => i.exerciseId))]
    const found = await db.exercises.bulkGet(exerciseIds)
    if (found.some((e) => !e)) throw new Error('One of the exercises was deleted. Remove it and try again.')

    await db.routines.put({
      id: routineId,
      name: draft.name.trim(),
      notes: draft.notes.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    })
    await db.routineExercises.where('routineId').equals(routineId).delete()
    await db.routineExercises.bulkAdd(
      draft.items.map((item, position) => ({
        id: item.id ?? newId(),
        routineId,
        exerciseId: item.exerciseId,
        position,
        targetSets: item.targetSets,
        repMin: item.repMin,
        repMax: item.repMax,
        targetWeightKg: item.targetWeightKg,
        restSeconds: item.restSeconds
      }))
    )
    return routineId
  })
}

export async function duplicateRoutine(id: string): Promise<string> {
  const source = await getRoutine(id)
  if (!source) throw new Error('That routine no longer exists.')
  const names = new Set((await db.routines.toArray()).map((r) => r.name))
  let name = `${source.name} (copy)`
  for (let n = 2; names.has(name); n++) name = `${source.name} (copy ${n})`
  return saveRoutine(null, {
    name,
    notes: source.notes,
    items: source.items.map(({ id: _id, ...item }) => item)
  })
}

/**
 * Deletes a routine and clears it from the schedule. Completed sessions keep
 * the routine name they were logged with.
 */
export async function deleteRoutine(id: string): Promise<void> {
  await db.transaction('rw', [db.routines, db.routineExercises, db.weeklyPlan, db.scheduleOverrides], async () => {
    await db.routineExercises.where('routineId').equals(id).delete()
    await db.weeklyPlan.where('routineId').equals(id).delete()
    await db.scheduleOverrides.where('routineId').equals(id).delete()
    await db.routines.delete(id)
  })
}

export async function routineScheduleUsage(id: string): Promise<{ weekdays: number[]; overrides: number }> {
  const [weekly, overrides] = await Promise.all([
    db.weeklyPlan.where('routineId').equals(id).toArray(),
    db.scheduleOverrides.where('routineId').equals(id).count()
  ])
  return { weekdays: weekly.map((w) => w.weekday), overrides }
}
