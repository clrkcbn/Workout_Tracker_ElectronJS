import { reactive } from 'vue'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  detail?: string
}

const toasts = reactive<Toast[]>([])
let nextId = 1

function push(tone: ToastTone, title: string, detail?: string) {
  const id = nextId++
  toasts.push({ id, tone, title, detail })
  if (toasts.length > 3) toasts.splice(0, toasts.length - 3)
  setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3500)
}

function dismiss(id: number) {
  const index = toasts.findIndex((t) => t.id === id)
  if (index >= 0) toasts.splice(index, 1)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (title: string, detail?: string) => push('success', title, detail),
    error: (title: string, detail?: string) => push('error', title, detail),
    info: (title: string, detail?: string) => push('info', title, detail)
  }
}
