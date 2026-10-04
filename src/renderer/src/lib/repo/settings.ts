import { db } from '../db'
import { DEFAULT_PREFERENCES, type Preferences } from '../types'

export async function getPreferences(): Promise<Preferences> {
  const rows = await db.settings.toArray()
  const prefs: Preferences = { ...DEFAULT_PREFERENCES }
  for (const row of rows) {
    if (row.key === 'unit' && (row.value === 'kg' || row.value === 'lb')) prefs.unit = row.value
    if (row.key === 'defaultRestSeconds' && typeof row.value === 'number' && row.value >= 0 && row.value <= 3600) {
      prefs.defaultRestSeconds = row.value
    }
    if (row.key === 'timerSound' && typeof row.value === 'boolean') prefs.timerSound = row.value
  }
  return prefs
}

export async function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): Promise<void> {
  await db.settings.put({ key, value })
}
