import { ref } from 'vue'
import { errorMessage } from '@/lib/utils'
import { useToast } from './useToast'

/**
 * Wraps an async action so it cannot run twice at once (no double submits)
 * and so failures surface as a friendly toast instead of a silent error.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: { errorTitle?: string } = {}) {
  const pending = ref(false)
  const toast = useToast()

  async function run(...args: A): Promise<R | undefined> {
    if (pending.value) return undefined
    pending.value = true
    try {
      return await fn(...args)
    } catch (error) {
      console.error(error)
      toast.error(options.errorTitle ?? 'That did not work', errorMessage(error))
      return undefined
    } finally {
      pending.value = false
    }
  }

  return { run, pending }
}
