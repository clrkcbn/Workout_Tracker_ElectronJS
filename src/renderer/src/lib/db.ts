import Dexie, { type EntityTable } from 'dexie'
import type {
  BodyweightEntry,
  Exercise,
  LoggedSet,
  Routine,
  RoutineExercise,
  ScheduleOverride,
  Session,
  SessionExercise,
  SettingRow,
  WeeklyPlanEntry
} from './types'

export const DB_NAME = 'pixel-gym-journal'

/**
 * Schema history. Each entry is applied in order by Dexie and must never be
 * edited once released — add a new version with an `upgrade` function instead.
 * Example for a future change:
 *
 *   { version: 2, stores: { exercises: 'id, name, muscleGroup, equipment, updatedAt, favorite' },
 *     upgrade: (tx) => tx.table('exercises').toCollection().modify((e) => { e.favorite = false }) }
 */
interface Migration {
  version: number
  stores: Record<string, string | null>
  upgrade?: Parameters<ReturnType<Dexie['version']>['upgrade']>[0]
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    stores: {
      exercises: 'id, name, muscleGroup, equipment, updatedAt',
      routines: 'id, name, updatedAt',
      routineExercises: 'id, routineId, exerciseId',
      weeklyPlan: 'weekday, routineId',
      scheduleOverrides: 'date, routineId',
      sessions: 'id, date, status, routineId',
      sessionExercises: 'id, sessionId, exerciseId',
      loggedSets: 'id, sessionId, sessionExerciseId, exerciseId',
      bodyweights: 'id, &date',
      settings: 'key'
    }
  }
]

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

export class GymDatabase extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  routines!: EntityTable<Routine, 'id'>
  routineExercises!: EntityTable<RoutineExercise, 'id'>
  weeklyPlan!: EntityTable<WeeklyPlanEntry, 'weekday'>
  scheduleOverrides!: EntityTable<ScheduleOverride, 'date'>
  sessions!: EntityTable<Session, 'id'>
  sessionExercises!: EntityTable<SessionExercise, 'id'>
  loggedSets!: EntityTable<LoggedSet, 'id'>
  bodyweights!: EntityTable<BodyweightEntry, 'id'>
  settings!: EntityTable<SettingRow, 'key'>

  constructor(name = DB_NAME) {
    super(name)
    for (const migration of MIGRATIONS) {
      const version = this.version(migration.version).stores(migration.stores)
      if (migration.upgrade) version.upgrade(migration.upgrade)
    }
  }
}

export const db = new GymDatabase()

/** Every user-data table, in the order used for backups. */
export const DATA_TABLES = [
  'exercises',
  'routines',
  'routineExercises',
  'weeklyPlan',
  'scheduleOverrides',
  'sessions',
  'sessionExercises',
  'loggedSets',
  'bodyweights',
  'settings'
] as const

export type DataTableName = (typeof DATA_TABLES)[number]

export function allTables() {
  return DATA_TABLES.map((name) => db.table(name))
}
