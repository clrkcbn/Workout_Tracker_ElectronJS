import { db } from '../db'
import { isDateKey, todayKey } from '../dates'
import type { BodyweightEntry, DateKey } from '../types'
import { newId } from '../utils'

export const MIN_BODYWEIGHT_KG = 20
export const MAX_BODYWEIGHT_KG = 400

export async function listBodyweights(): Promise<BodyweightEntry[]> {
  return db.bodyweights.orderBy('date').toArray()
}

/** One measurement per day: logging the same date again replaces it. */
export async function saveBodyweight(date: DateKey, weightKg: number): Promise<void> {
  if (!isDateKey(date)) throw new Error('Pick a valid date.')
  if (date > todayKey()) throw new Error('Measurements cannot be in the future.')
  if (!Number.isFinite(weightKg) || weightKg < MIN_BODYWEIGHT_KG || weightKg > MAX_BODYWEIGHT_KG) {
    throw new Error('That bodyweight looks out of range.')
  }
  await db.transaction('rw', db.bodyweights, async () => {
    const now = Date.now()
    const existing = await db.bodyweights.where('date').equals(date).first()
    if (existing) await db.bodyweights.update(existing.id, { weightKg, updatedAt: now })
    else await db.bodyweights.add({ id: newId(), date, weightKg, createdAt: now, updatedAt: now })
  })
}

export async function deleteBodyweight(id: string): Promise<void> {
  await db.bodyweights.delete(id)
}
