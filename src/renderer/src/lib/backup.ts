import { allTables, db, DATA_TABLES, SCHEMA_VERSION, type DataTableName } from './db'
import { isDateKey, todayKey } from './dates'
import { EQUIPMENT, MUSCLE_GROUPS } from './types'

export const BACKUP_APP_ID = 'pixel-gym-journal'
export const BACKUP_FORMAT_VERSION = 1

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  formatVersion: number
  schemaVersion: number
  exportedAt: string
  data: Record<DataTableName, Record<string, unknown>[]>
}

export interface BackupPreview {
  exportedAt: string
  counts: Record<DataTableName, number>
  firstWorkout: string | null
  lastWorkout: string | null
}

export type BackupValidation = { ok: true; backup: BackupFile; preview: BackupPreview } | { ok: false; errors: string[] }

export async function createBackup(): Promise<BackupFile> {
  return db.transaction('r', allTables(), async () => {
    const data = {} as BackupFile['data']
    for (const name of DATA_TABLES) data[name] = (await db.table(name).toArray()) as Record<string, unknown>[]
    return {
      app: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data
    }
  })
}

export function backupFileName(): string {
  return `pixel-gym-journal-${todayKey()}.json`
}

// ---- validation -------------------------------------------------------------

type FieldCheck = (value: unknown) => boolean
const str: FieldCheck = (v) => typeof v === 'string'
const id: FieldCheck = (v) => typeof v === 'string' && v.length > 0 && v.length <= 100
const num: FieldCheck = (v) => typeof v === 'number' && Number.isFinite(v)
const nonNeg: FieldCheck = (v) => num(v) && (v as number) >= 0
const int = (min: number, max: number): FieldCheck => (v) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const nullable = (check: FieldCheck): FieldCheck => (v) => v === null || check(v)
const bool: FieldCheck = (v) => typeof v === 'boolean'
const date: FieldCheck = (v) => isDateKey(v)
const oneOf = (values: readonly string[]): FieldCheck => (v) => typeof v === 'string' && values.includes(v)

const SHAPES: Record<DataTableName, Record<string, FieldCheck>> = {
  exercises: { id, name: str, muscleGroup: oneOf(MUSCLE_GROUPS), equipment: oneOf(EQUIPMENT), notes: str, createdAt: num, updatedAt: num },
  routines: { id, name: str, notes: str, createdAt: num, updatedAt: num },
  routineExercises: {
    id, routineId: id, exerciseId: id, position: int(0, 10_000), targetSets: int(1, 50), repMin: int(1, 999),
    repMax: int(1, 999), targetWeightKg: nullable(nonNeg), restSeconds: int(0, 3600)
  },
  weeklyPlan: { weekday: int(0, 6), kind: oneOf(['routine', 'rest']), routineId: nullable(id), updatedAt: num },
  scheduleOverrides: { date, kind: oneOf(['routine', 'rest']), routineId: nullable(id), updatedAt: num },
  sessions: {
    id, date, status: oneOf(['active', 'completed']), routineId: nullable(id), routineName: str, notes: str,
    startedAt: num, finishedAt: nullable(num), createdAt: num, updatedAt: num
  },
  sessionExercises: {
    id, sessionId: id, exerciseId: id, position: int(0, 10_000), name: str, muscleGroup: oneOf(MUSCLE_GROUPS),
    equipment: oneOf(EQUIPMENT), isBodyweight: bool, targetSets: nullable(int(1, 50)), repMin: nullable(int(1, 999)),
    repMax: nullable(int(1, 999)), targetWeightKg: nullable(nonNeg), restSeconds: int(0, 3600)
  },
  loggedSets: {
    id, sessionId: id, sessionExerciseId: id, exerciseId: id, position: int(0, 10_000), reps: nullable(int(0, 999)),
    weightKg: nullable(nonNeg), completed: bool, completedAt: nullable(num)
  },
  bodyweights: { id, date, weightKg: nonNeg, createdAt: num, updatedAt: num },
  settings: { key: str }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parses and validates backup JSON. Nothing is written to the database here. */
export function validateBackup(text: string): BackupValidation {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['This file is not valid JSON, so it cannot be a Pixel Gym Journal backup.'] }
  }
  if (!isObject(parsed) || parsed.app !== BACKUP_APP_ID) {
    return { ok: false, errors: ['This file is not a Pixel Gym Journal backup.'] }
  }
  if (parsed.formatVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, errors: [`Unsupported backup format version (${String(parsed.formatVersion)}).`] }
  }
  if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, errors: ['This backup was made by a newer version of the app. Update the app, then try again.'] }
  }
  if (!isObject(parsed.data)) return { ok: false, errors: ['The backup has no data section.'] }

  const errors: string[] = []
  const data = parsed.data
  for (const table of DATA_TABLES) {
    const rows = data[table]
    if (rows === undefined) {
      errors.push(`Missing “${table}” data.`)
      continue
    }
    if (!Array.isArray(rows)) {
      errors.push(`“${table}” should be a list.`)
      continue
    }
    const shape = SHAPES[table]
    const keyField = Object.keys(shape)[0]
    const seen = new Set<unknown>()
    rows.forEach((row, index) => {
      if (errors.length > 20) return
      if (!isObject(row)) {
        errors.push(`${table} #${index + 1} is not an object.`)
        return
      }
      for (const [field, check] of Object.entries(shape)) {
        if (!check(row[field])) errors.push(`${table} #${index + 1}: “${field}” is missing or invalid.`)
      }
      if (seen.has(row[keyField])) errors.push(`${table} #${index + 1}: duplicate ${keyField}.`)
      seen.add(row[keyField])
    })
  }

  if (!errors.length) {
    // Cross-references must point at rows inside the backup.
    const ids = (t: DataTableName) => new Set((data[t] as Record<string, unknown>[]).map((r) => r.id))
    const exerciseIds = ids('exercises')
    const routineIds = ids('routines')
    const sessionIds = ids('sessions')
    const sessionExerciseIds = ids('sessionExercises')
    const rows = (t: DataTableName) => data[t] as Record<string, unknown>[]
    if (rows('routineExercises').some((r) => !routineIds.has(r.routineId) || !exerciseIds.has(r.exerciseId))) {
      errors.push('Some routine exercises point at missing routines or exercises.')
    }
    if (rows('sessionExercises').some((r) => !sessionIds.has(r.sessionId))) errors.push('Some logged exercises point at missing workouts.')
    if (rows('loggedSets').some((r) => !sessionIds.has(r.sessionId) || !sessionExerciseIds.has(r.sessionExerciseId))) {
      errors.push('Some logged sets point at missing workouts.')
    }
    if (rows('sessions').filter((s) => s.status === 'active').length > 1) errors.push('The backup has more than one unfinished workout.')
    if (new Set(rows('bodyweights').map((b) => b.date)).size !== rows('bodyweights').length) {
      errors.push('The backup has two bodyweight entries on the same date.')
    }
  }

  if (errors.length) return { ok: false, errors: errors.slice(0, 20) }

  const backup = parsed as unknown as BackupFile
  const counts = Object.fromEntries(DATA_TABLES.map((t) => [t, backup.data[t].length])) as Record<DataTableName, number>
  const dates = backup.data.sessions
    .filter((s) => s.status === 'completed')
    .map((s) => s.date as string)
    .sort()
  return {
    ok: true,
    backup,
    preview: {
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
      counts,
      firstWorkout: dates[0] ?? null,
      lastWorkout: dates[dates.length - 1] ?? null
    }
  }
}

/** Replaces every table with the backup contents in a single transaction. */
export async function restoreBackup(backup: BackupFile): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    for (const name of DATA_TABLES) {
      await db.table(name).clear()
      await db.table(name).bulkAdd(backup.data[name])
    }
  })
}

export async function resetAllData(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    for (const name of DATA_TABLES) await db.table(name).clear()
  })
}
