import type { DateKey } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date key for a JS date (the computer's timezone, not UTC). */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayKey(): DateKey {
  return toDateKey(new Date())
}

/** Parses to local noon, which keeps day arithmetic safe across DST changes. */
export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return toDateKey(parseDateKey(value)) === value
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

export function weekdayOf(key: DateKey): number {
  return parseDateKey(key).getDay()
}

/** Monday of the week containing `key`. */
export function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -((weekdayOf(key) + 6) % 7))
}

export function weekDates(key: DateKey): DateKey[] {
  const start = startOfWeek(key)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Whole days since 1970-01-01 for a local date; gives charts an evenly scaled time axis. */
export function dayNumber(key: DateKey): number {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function fromDayNumber(n: number): DateKey {
  const d = new Date(Math.round(n) * 86_400_000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7)
}

/** Weekday order shown in the UI: Monday first. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatDate(key: DateKey, style: 'long' | 'medium' | 'short' = 'medium'): string {
  const d = parseDateKey(key)
  if (style === 'long') {
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  if (style === 'short') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h}h ${pad(m)}m` : `${m} min`
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}
