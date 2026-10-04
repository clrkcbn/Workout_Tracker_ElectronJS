/** Local calendar date in `YYYY-MM-DD` form. Never a UTC timestamp. */
export type DateKey = string
export type Unit = 'kg' | 'lb'

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Full body', 'Other'] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Other'] as const
export type Equipment = (typeof EQUIPMENT)[number]

export interface Exercise {
  id: string
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Routine {
  id: string
  name: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface RoutineExercise {
  id: string
  routineId: string
  exerciseId: string
  position: number
  targetSets: number
  repMin: number
  repMax: number
  /** Always stored in kilograms; `null` means no target. */
  targetWeightKg: number | null
  restSeconds: number
}

export type PlanKind = 'routine' | 'rest'

export interface WeeklyPlanEntry {
  /** 0 = Sunday … 6 = Saturday, matching `Date#getDay()`. */
  weekday: number
  kind: PlanKind
  routineId: string | null
  updatedAt: number
}

export interface ScheduleOverride {
  date: DateKey
  kind: PlanKind
  routineId: string | null
  updatedAt: number
}

export type SessionStatus = 'active' | 'completed'

export interface Session {
  id: string
  date: DateKey
  status: SessionStatus
  routineId: string | null
  /** Snapshot so history survives routine renames and deletions. */
  routineName: string
  notes: string
  startedAt: number
  finishedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface SessionExercise {
  id: string
  sessionId: string
  /** May point at an exercise that has since been deleted. */
  exerciseId: string
  position: number
  // Snapshot of the exercise at the time it was logged.
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  isBodyweight: boolean
  // Snapshot of the routine targets, if it came from a routine.
  targetSets: number | null
  repMin: number | null
  repMax: number | null
  targetWeightKg: number | null
  restSeconds: number
}

export interface LoggedSet {
  id: string
  sessionId: string
  sessionExerciseId: string
  exerciseId: string
  position: number
  reps: number | null
  /** Kilograms. For bodyweight exercises this is *added* load and may be null. */
  weightKg: number | null
  completed: boolean
  completedAt: number | null
}

export interface BodyweightEntry {
  id: string
  date: DateKey
  weightKg: number
  createdAt: number
  updatedAt: number
}

export interface SettingRow {
  key: string
  value: unknown
}

export interface Preferences {
  unit: Unit
  defaultRestSeconds: number
  timerSound: boolean
}

export const DEFAULT_PREFERENCES: Preferences = {
  unit: 'kg',
  defaultRestSeconds: 90,
  timerSound: true
}

export function isBodyweightEquipment(equipment: Equipment): boolean {
  return equipment === 'Bodyweight'
}
