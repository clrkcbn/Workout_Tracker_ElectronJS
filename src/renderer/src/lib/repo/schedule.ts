import { db } from '../db'
import { isDateKey, weekdayOf } from '../dates'
import type { DateKey, PlanKind, Routine, ScheduleOverride, WeeklyPlanEntry } from '../types'

/** What a single day looks like once the weekly plan and date overrides are combined. */
export type DayPlan =
  | { kind: 'none'; source: 'weekly' | 'override' }
  | { kind: 'rest'; source: 'weekly' | 'override' }
  | { kind: 'routine'; source: 'weekly' | 'override'; routineId: string; routineName: string }

export type PlanChoice = { kind: 'none' } | { kind: 'rest' } | { kind: 'routine'; routineId: string }

export interface ScheduleData {
  weekly: WeeklyPlanEntry[]
  overrides: ScheduleOverride[]
  routines: Routine[]
}

export async function loadSchedule(): Promise<ScheduleData> {
  const [weekly, overrides, routines] = await Promise.all([
    db.weeklyPlan.toArray(),
    db.scheduleOverrides.toArray(),
    db.routines.toArray()
  ])
  return { weekly, overrides, routines }
}

function toPlan(
  entry: { kind: PlanKind; routineId: string | null },
  source: 'weekly' | 'override',
  routineById: Map<string, Routine>
): DayPlan {
  if (entry.kind === 'rest') return { kind: 'rest', source }
  const routine = entry.routineId ? routineById.get(entry.routineId) : undefined
  if (!routine) return { kind: 'none', source }
  return { kind: 'routine', source, routineId: routine.id, routineName: routine.name }
}

/** Date-specific overrides win over the recurring weekly plan. */
export function resolveDayPlan(date: DateKey, data: ScheduleData): DayPlan {
  const routineById = new Map(data.routines.map((r) => [r.id, r]))
  const override = data.overrides.find((o) => o.date === date)
  if (override) return toPlan(override, 'override', routineById)
  const weekly = data.weekly.find((w) => w.weekday === weekdayOf(date))
  if (weekly) return toPlan(weekly, 'weekly', routineById)
  return { kind: 'none', source: 'weekly' }
}

export async function setWeeklyDay(weekday: number, choice: PlanChoice): Promise<void> {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('Invalid weekday.')
  if (choice.kind === 'none') {
    await db.weeklyPlan.delete(weekday)
    return
  }
  await db.weeklyPlan.put({
    weekday,
    kind: choice.kind,
    routineId: choice.kind === 'routine' ? choice.routineId : null,
    updatedAt: Date.now()
  })
}

/**
 * Sets a one-off plan for a date without touching the weekly plan.
 * Pass `null` to remove the override and fall back to the weekly plan.
 */
export async function setDateOverride(date: DateKey, choice: Exclude<PlanChoice, { kind: 'none' }> | null): Promise<void> {
  if (!isDateKey(date)) throw new Error('Invalid date.')
  if (!choice) {
    await db.scheduleOverrides.delete(date)
    return
  }
  await db.scheduleOverrides.put({
    date,
    kind: choice.kind,
    routineId: choice.kind === 'routine' ? choice.routineId : null,
    updatedAt: Date.now()
  })
}
