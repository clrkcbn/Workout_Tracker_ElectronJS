import { liveQuery, type Subscription } from 'dexie'
import { onScopeDispose, ref, shallowRef, watch, type Ref, type ShallowRef, type WatchSource } from 'vue'

export interface LiveQueryState<T> {
  data: ShallowRef<T | undefined>
  loading: Ref<boolean>
  error: Ref<unknown>
}

/**
 * Subscribes to a Dexie query and re-runs it whenever the underlying tables
 * change (or any of `deps` change). Exposes loading and error state for the UI.
 */
export function useLiveQuery<T>(querier: () => Promise<T> | T, deps: WatchSource[] = []): LiveQueryState<T> {
  const data = shallowRef<T | undefined>()
  const loading = ref(true)
  const error = ref<unknown>(null)
  let subscription: Subscription | null = null

  const start = () => {
    subscription?.unsubscribe()
    loading.value = true
    subscription = liveQuery(querier).subscribe({
      next: (value) => {
        data.value = value
        error.value = null
        loading.value = false
      },
      error: (err) => {
        console.error(err)
        error.value = err
        loading.value = false
      }
    })
  }

  if (deps.length) watch(deps, start, { immediate: true })
  else start()

  onScopeDispose(() => subscription?.unsubscribe())
  return { data, loading, error }
}
