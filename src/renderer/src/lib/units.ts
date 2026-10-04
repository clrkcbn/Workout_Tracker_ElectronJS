import type { Unit } from './types'

/** Exact international avoirdupois pound. */
export const KG_PER_LB = 0.45359237

export const MAX_WEIGHT_KG = 1000
export const MAX_REPS = 999

/** Weights are stored in kg at full precision, so switching units never loses data. */
export function kgToUnit(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB
}

export function unitToKg(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB
}

/** Rounds for display only: two decimals at most. */
export function roundForDisplay(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatNumber(value: number, maxDecimals = 2): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: maxDecimals })
}

export function displayWeight(kg: number | null | undefined, unit: Unit): string {
  if (kg == null) return ''
  return formatNumber(kgToUnit(kg, unit))
}

export function formatWeight(kg: number | null | undefined, unit: Unit): string {
  if (kg == null) return '—'
  return `${displayWeight(kg, unit)} ${unit}`
}

/** Value for an editable text field (no thousands separators). */
export function weightInputValue(kg: number | null | undefined, unit: Unit): string {
  if (kg == null) return ''
  return String(roundForDisplay(kgToUnit(kg, unit)))
}

export type ParseResult = { ok: true; value: number | null } | { ok: false; error: string }

/** Parses a typed weight in the display unit and returns kilograms. */
export function parseWeightInput(raw: string, unit: Unit, { required = false } = {}): ParseResult {
  const text = raw.trim().replace(',', '.')
  if (text === '') return required ? { ok: false, error: 'Enter a weight' } : { ok: true, value: null }
  if (!/^\d{0,4}(\.\d{0,2})?$/.test(text) || text === '.') return { ok: false, error: 'Use a number like 62.5' }
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: 'Weight must be 0 or more' }
  const kg = unitToKg(value, unit)
  if (kg > MAX_WEIGHT_KG) return { ok: false, error: 'That weight looks too high' }
  return { ok: true, value: kg }
}

export function parseRepsInput(raw: string, { required = false } = {}): ParseResult {
  const text = raw.trim()
  if (text === '') return required ? { ok: false, error: 'Enter reps' } : { ok: true, value: null }
  if (!/^\d{1,3}$/.test(text)) return { ok: false, error: 'Reps must be a whole number' }
  const value = Number(text)
  if (value > MAX_REPS) return { ok: false, error: 'Reps look out of range' }
  return { ok: true, value }
}
