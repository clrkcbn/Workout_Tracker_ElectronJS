import { db } from '../db'
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type Exercise, type MuscleGroup } from '../types'
import { newId } from '../utils'

export interface ExerciseInput {
  name: string
  muscleGroup: MuscleGroup
  equipment: Equipment
  notes: string
}

export function validateExerciseInput(input: ExerciseInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const name = input.name.trim()
  if (!name) errors.name = 'Give the exercise a name.'
  else if (name.length > 80) errors.name = 'Keep the name under 80 characters.'
  if (!MUSCLE_GROUPS.includes(input.muscleGroup)) errors.muscleGroup = 'Pick a muscle group.'
  if (!EQUIPMENT.includes(input.equipment)) errors.equipment = 'Pick the equipment.'
  if (input.notes.length > 1000) errors.notes = 'Notes are limited to 1000 characters.'
  return errors
}

export async function listExercises(): Promise<Exercise[]> {
  const all = await db.exercises.toArray()
  return all.sort((a, b) => a.name.localeCompare(b.name))
}

async function assertUniqueName(name: string, ignoreId?: string) {
  const lower = name.trim().toLowerCase()
  const clash = await db.exercises.filter((e) => e.id !== ignoreId && e.name.trim().toLowerCase() === lower).first()
  if (clash) throw new Error(`You already have an exercise called “${clash.name}”.`)
}

export async function createExercise(input: ExerciseInput): Promise<Exercise> {
  const now = Date.now()
  const exercise: Exercise = { id: newId(), ...input, name: input.name.trim(), notes: input.notes.trim(), createdAt: now, updatedAt: now }
  await db.transaction('rw', db.exercises, async () => {
    await assertUniqueName(exercise.name)
    await db.exercises.add(exercise)
  })
  return exercise
}

export async function updateExercise(id: string, input: ExerciseInput): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    await assertUniqueName(input.name, id)
    const count = await db.exercises.update(id, {
      name: input.name.trim(),
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      notes: input.notes.trim(),
      updatedAt: Date.now()
    })
    if (!count) throw new Error('That exercise no longer exists.')
  })
}

/** How many routines use an exercise, so deletes can warn first. */
export async function exerciseUsage(id: string): Promise<{ routines: string[]; loggedSessions: number }> {
  const items = await db.routineExercises.where('exerciseId').equals(id).toArray()
  const routineIds = [...new Set(items.map((i) => i.routineId))]
  const routines = (await db.routines.bulkGet(routineIds)).filter(Boolean).map((r) => r!.name)
  const sessionIds = new Set((await db.sessionExercises.where('exerciseId').equals(id).toArray()).map((s) => s.sessionId))
  return { routines, loggedSessions: sessionIds.size }
}

/**
 * Deletes an exercise and removes it from routines. Logged history keeps its
 * own snapshot (name, muscle group, equipment), so past workouts stay intact.
 */
export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.routineExercises, async () => {
    await db.routineExercises.where('exerciseId').equals(id).delete()
    await db.exercises.delete(id)
  })
}

export const STARTER_EXERCISES: Array<Pick<Exercise, 'name' | 'muscleGroup' | 'equipment'>> = [
  { name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { name: 'Incline Dumbbell Press', muscleGroup: 'Chest', equipment: 'Dumbbell' },
  { name: 'Push-up', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  { name: 'Cable Fly', muscleGroup: 'Chest', equipment: 'Cable' },
  { name: 'Dip', muscleGroup: 'Chest', equipment: 'Bodyweight' },
  { name: 'Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
  { name: 'Pull-up', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { name: 'Chin-up', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { name: 'Barbell Row', muscleGroup: 'Back', equipment: 'Barbell' },
  { name: 'One-Arm Dumbbell Row', muscleGroup: 'Back', equipment: 'Dumbbell' },
  { name: 'Lat Pulldown', muscleGroup: 'Back', equipment: 'Cable' },
  { name: 'Seated Cable Row', muscleGroup: 'Back', equipment: 'Cable' },
  { name: 'Overhead Press', muscleGroup: 'Shoulders', equipment: 'Barbell' },
  { name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
  { name: 'Face Pull', muscleGroup: 'Shoulders', equipment: 'Cable' },
  { name: 'Barbell Curl', muscleGroup: 'Arms', equipment: 'Barbell' },
  { name: 'Hammer Curl', muscleGroup: 'Arms', equipment: 'Dumbbell' },
  { name: 'Triceps Pushdown', muscleGroup: 'Arms', equipment: 'Cable' },
  { name: 'Overhead Triceps Extension', muscleGroup: 'Arms', equipment: 'Dumbbell' },
  { name: 'Back Squat', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Front Squat', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Leg Press', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Romanian Deadlift', muscleGroup: 'Legs', equipment: 'Barbell' },
  { name: 'Bulgarian Split Squat', muscleGroup: 'Legs', equipment: 'Dumbbell' },
  { name: 'Walking Lunge', muscleGroup: 'Legs', equipment: 'Dumbbell' },
  { name: 'Leg Curl', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Leg Extension', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Standing Calf Raise', muscleGroup: 'Legs', equipment: 'Machine' },
  { name: 'Hip Thrust', muscleGroup: 'Glutes', equipment: 'Barbell' },
  { name: 'Glute Bridge', muscleGroup: 'Glutes', equipment: 'Bodyweight' },
  { name: 'Hanging Leg Raise', muscleGroup: 'Core', equipment: 'Bodyweight' },
  { name: 'Cable Crunch', muscleGroup: 'Core', equipment: 'Cable' },
  { name: 'Ab Wheel Rollout', muscleGroup: 'Core', equipment: 'Other' },
  { name: 'Kettlebell Swing', muscleGroup: 'Full body', equipment: 'Kettlebell' },
  { name: 'Goblet Squat', muscleGroup: 'Legs', equipment: 'Kettlebell' }
]

/** Adds starter exercises that are not already in the library. Creates no workout history. */
export async function addStarterLibrary(): Promise<number> {
  return db.transaction('rw', db.exercises, async () => {
    const existing = new Set((await db.exercises.toArray()).map((e) => e.name.trim().toLowerCase()))
    const now = Date.now()
    const toAdd: Exercise[] = STARTER_EXERCISES.filter((e) => !existing.has(e.name.toLowerCase())).map((e) => ({
      id: newId(),
      ...e,
      notes: '',
      createdAt: now,
      updatedAt: now
    }))
    await db.exercises.bulkAdd(toAdd)
    return toAdd.length
  })
}
