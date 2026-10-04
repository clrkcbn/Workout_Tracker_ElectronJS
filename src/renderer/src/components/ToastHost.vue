<script setup lang="ts">
import { useToast } from '@/composables/useToast'
import PixelGlyph from './pixel/PixelGlyph.vue'

const { toasts, dismiss } = useToast()
const toneClass = { success: 'bg-leaf-100', error: 'bg-berry-100', info: 'bg-sky-100' }
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-3" aria-live="polite">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :role="toast.tone === 'error' ? 'alert' : 'status'"
      class="pixel-box pointer-events-auto flex animate-pop items-start gap-3 p-3"
      :class="toneClass[toast.tone]"
    >
      <PixelGlyph :name="toast.tone === 'error' ? 'close' : toast.tone === 'success' ? 'check' : 'dot'" class="mt-1" />
      <div class="min-w-0 flex-1">
        <p class="font-bold">{{ toast.title }}</p>
        <p v-if="toast.detail" class="text-sm text-ink-soft">{{ toast.detail }}</p>
      </div>
      <button class="rounded p-1 text-ink-soft hover:text-ink" aria-label="Dismiss" @click="dismiss(toast.id)">
        <PixelGlyph name="close" :size="8" />
      </button>
    </div>
  </div>
</template>
