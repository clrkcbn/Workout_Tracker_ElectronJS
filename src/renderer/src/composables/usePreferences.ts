import { liveQuery } from 'dexie'
import { computed, reactive, readonly } from 'vue'
import { getPreferences } from '@/lib/repo/settings'
import { DEFAULT_PREFERENCES, type Preferences } from '@/lib/types'
import { displayWeight, formatWeight, weightInputValue } from '@/lib/units'

const state = reactive<Preferences & { ready: boolean }>({ ...DEFAULT_PREFERENCES, ready: false })
let started = false

/** App-wide preferences, kept in sync with the database. */
export function usePreferences() {
  if (!started) {
    started = true
    liveQuery(getPreferences).subscribe({
      next: (prefs) => {
        Object.assign(state, prefs)
        state.ready = true
      },
      error: (err) => console.error('Could not load preferences', err)
    })
  }
  const unit = computed(() => state.unit)
  return {
    prefs: readonly(state),
    unit,
    fmtWeight: (kg: number | null | undefined) => formatWeight(kg, state.unit),
    showWeight: (kg: number | null | undefined) => displayWeight(kg, state.unit),
    inputWeight: (kg: number | null | undefined) => weightInputValue(kg, state.unit)
  }
}
