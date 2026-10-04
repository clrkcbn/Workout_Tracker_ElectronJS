import { beforeEach, describe, expect, it } from 'vitest'
import { db, GymDatabase, DB_NAME } from '@/lib/db'
import { addDays, startOfWeek, toDateKey, todayKey, weekdayOf } from '@/lib/dates'
import { createBackup, resetAllData, restoreBackup, validateBackup } from '@/lib/backup'
import { addStarterLibrary, createExercise, deleteExercise } from '@/lib/repo/exercises'
import { deleteRoutine, duplicateRoutine, getRoutine, saveRoutine } from '@/lib/repo/routines'
import { loadSchedule, resolveDayPlan, setDateOverride, setWeeklyDay } from '@/lib/repo/schedule'
import {
  addSet,
  deleteSession,
  finishSession,
  getActiveSession,
  getPreviousPerformance,
  loadCompletedHistory,
  loadSessionDetail,
  saveSessionCorrection,
  startSession,
  updateSet
} from '@/lib/repo/sessions'
import { getPreferences, setPreference } from '@/lib/repo/settings'
import { buildExerciseHistories, computeRecords, estimateOneRepMax } from '@/lib/stats'
import { displayWeight, kgToUnit, parseWeightInput, unitToKg, weightInputValue } from '@/lib/units'

beforeEach(async () => {
  await resetAllData()
})

async function makeRoutine() {
  const bench = await createExercise({ name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell', notes: '' })
  const pullup = await createExercise({ name: 'Pull-up', muscleGroup: 'Back', equipment: 'Bodyweight', notes: '' })
  const routineId = await saveRoutine(null, {
    name: 'Upper A',
    notes: '',
    items: [
      { exerciseId: bench.id, targetSets: 3, repMin: 5, repMax: 8, targetWeightKg: 60, restSeconds: 120 },
      { exerciseId: pullup.id, targetSets: 2, repMin: 6, repMax: 10, targetWeightKg: null, restSeconds: 90 }
    ]
  })
  return { bench, pullup, routineId }
}

async function logWorkout(routineId: string, date: string, bench: Array<[number, number]>, pullups: number[]) {
  const { id } = await startSession({ routineId, date })
  const detail = (await loadSessionDetail(id))!
  const [b, p] = detail.exercises
  for (let i = 0; i < bench.length; i++) {
    const setId = b.sets[i]?.id ?? (await addSet(b.id))
    await updateSet(setId, { weightKg: bench[i][0], reps: bench[i][1], completed: true })
  }
  for (let i = 0; i < pullups.length; i++) {
    await updateSet(p.sets[i].id, { reps: pullups[i], completed: true })
  }
  await finishSession(id)
  return id
}

describe('dates', () => {
  it('uses local calendar dates', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekdayOf('2026-10-04')).toBe(0)
    expect(startOfWeek('2026-10-04')).toBe('2026-09-28')
  })
})

describe('units', () => {
  it('converts losslessly between kg and lb', () => {
    const kg = unitToKg(135, 'lb')
    expect(kgToUnit(kg, 'lb')).toBeCloseTo(135, 10)
    expect(weightInputValue(kg, 'lb')).toBe('135')
    expect(displayWeight(100, 'lb')).toBe('220.46')
    expect(parseWeightInput('abc', 'kg').ok).toBe(false)
    expect(parseWeightInput('', 'kg', { required: true }).ok).toBe(false)
    expect(parseWeightInput('62,5', 'kg')).toEqual({ ok: true, value: 62.5 })
  })

  it('keeps stored kg unchanged when switching the display unit', async () => {
    await setPreference('unit', 'lb')
    expect((await getPreferences()).unit).toBe('lb')
  })
})

describe('routines and schedule', () => {
  it('creates, duplicates and deletes routines', async () => {
    const { routineId } = await makeRoutine()
    const routine = await getRoutine(routineId)
    expect(routine?.items.map((i) => i.exercise?.name)).toEqual(['Bench Press', 'Pull-up'])
    const copyId = await duplicateRoutine(routineId)
    expect((await getRoutine(copyId))?.name).toBe('Upper A (copy)')
    await expect(saveRoutine(null, { name: '', notes: '', items: [] })).rejects.toThrow()
  })

  it('resolves weekly plans and date overrides', async () => {
    const { routineId } = await makeRoutine()
    await setWeeklyDay(1, { kind: 'routine', routineId })
    await setWeeklyDay(3, { kind: 'rest' })
    const monday = '2026-10-05'
    await setDateOverride('2026-10-12', { kind: 'rest' })
    let data = await loadSchedule()
    expect(resolveDayPlan(monday, data)).toMatchObject({ kind: 'routine', routineName: 'Upper A', source: 'weekly' })
    expect(resolveDayPlan('2026-10-12', data)).toMatchObject({ kind: 'rest', source: 'override' })
    expect(resolveDayPlan('2026-10-19', data)).toMatchObject({ kind: 'routine' })
    expect(resolveDayPlan('2026-10-07', data)).toMatchObject({ kind: 'rest' })
    expect(resolveDayPlan('2026-10-06', data)).toMatchObject({ kind: 'none' })

    await deleteRoutine(routineId)
    data = await loadSchedule()
    expect(resolveDayPlan(monday, data).kind).toBe('none')
  })
})

describe('workout sessions', () => {
  it('logs, recovers and finishes a workout', async () => {
    const { routineId, bench } = await makeRoutine()
    const { id } = await startSession({ routineId })
    const detail = (await loadSessionDetail(id))!
    expect(detail.exercises).toHaveLength(2)
    expect(detail.exercises[0].sets).toHaveLength(3)

    await updateSet(detail.exercises[0].sets[0].id, { weightKg: 60, reps: 8, completed: true })

    // Simulate an app restart by opening a fresh connection to the same database.
    const reopened = new GymDatabase(DB_NAME)
    const active = await reopened.sessions.where('status').equals('active').first()
    expect(active?.id).toBe(id)
    reopened.close()
    expect((await getActiveSession())?.id).toBe(id)

    // A second start resumes rather than creating another workout.
    expect(await startSession({ routineId })).toEqual({ id, resumed: true })

    const { removedSets } = await finishSession(id)
    expect(removedSets).toBe(4)
    const finished = (await loadSessionDetail(id))!
    expect(finished.session.status).toBe('completed')
    expect(finished.exercises.map((e) => e.name)).toEqual(['Bench Press'])

    // Deleting the exercise keeps the logged snapshot.
    await deleteExercise(bench.id)
    expect((await loadSessionDetail(id))!.exercises[0].name).toBe('Bench Press')
  })

  it('refuses to finish an empty workout', async () => {
    const { routineId } = await makeRoutine()
    const { id } = await startSession({ routineId })
    await expect(finishSession(id)).rejects.toThrow(/at least one set/)
    await deleteSession(id)
    expect(await getActiveSession()).toBeUndefined()
  })

  it('shows previous performance and computes records', async () => {
    const { routineId, bench, pullup } = await makeRoutine()
    const today = todayKey()
    await logWorkout(routineId, addDays(today, -7), [[60, 8], [60, 8], [60, 7]], [6, 5])
    const second = await logWorkout(routineId, addDays(today, -3), [[62.5, 8], [62.5, 6], [60, 8]], [8, 6])

    const prev = await getPreviousPerformance(bench.id)
    expect(prev?.sessionId).toBe(second)
    expect(prev?.sets[0]).toEqual({ reps: 8, weightKg: 62.5 })

    const histories = buildExerciseHistories(await loadCompletedHistory())
    const { events, current } = computeRecords(histories)
    expect(events.map((e) => `${e.exerciseName}:${e.type}`).sort()).toEqual([
      'Bench Press:e1rm',
      'Bench Press:heaviest',
      'Pull-up:reps'
    ])
    const benchBests = current.get(bench.id)!
    expect(benchBests.find((r) => r.type === 'heaviest')?.value).toBe(62.5)
    expect(benchBests.find((r) => r.type === 'e1rm')?.value).toBeCloseTo(estimateOneRepMax(62.5, 8)!)
    expect(current.get(pullup.id)!.find((r) => r.type === 'reps')?.value).toBe(8)

    // Correcting history updates the records.
    const detail = (await loadSessionDetail(second))!
    await saveSessionCorrection(second, {
      date: detail.session.date,
      notes: 'fixed typo',
      exercises: detail.exercises.map((ex) => ({
        id: ex.id,
        sets: ex.sets.map((s) => ({ id: s.id, reps: s.reps!, weightKg: ex.isBodyweight ? s.weightKg : 55 }))
      }))
    })
    const after = computeRecords(buildExerciseHistories(await loadCompletedHistory()))
    expect(after.current.get(bench.id)!.find((r) => r.type === 'heaviest')?.value).toBe(60)
    expect((await loadSessionDetail(second))!.session.notes).toBe('fixed typo')
  })
})

describe('backups', () => {
  it('exports, validates and restores all data', async () => {
    const { routineId } = await makeRoutine()
    await logWorkout(routineId, addDays(todayKey(), -1), [[50, 5]], [5])
    await addStarterLibrary()
    const backup = await createBackup()
    const text = JSON.stringify(backup)

    await resetAllData()
    expect(await db.exercises.count()).toBe(0)

    const result = validateBackup(text)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.preview.counts.sessions).toBe(1)
    await restoreBackup(result.backup)
    expect(await db.routines.count()).toBe(1)
    expect(await db.loggedSets.count()).toBe(2)
  })

  it('rejects invalid backup files with clear errors', () => {
    expect(validateBackup('not json')).toMatchObject({ ok: false })
    expect(validateBackup('{"hello":1}')).toMatchObject({ ok: false, errors: ['This file is not a Pixel Gym Journal backup.'] })
    const broken = { app: 'pixel-gym-journal', formatVersion: 1, schemaVersion: 1, exportedAt: '', data: { exercises: [{ id: 'x' }] } }
    const result = validateBackup(JSON.stringify(broken))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0)
  })
})
