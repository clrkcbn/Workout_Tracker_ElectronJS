<script setup lang="ts">
import { errorMessage } from '@/lib/utils'
import PixelSprite from './pixel/PixelSprite.vue'

defineProps<{ loading: boolean; error: unknown }>()
</script>

<template>
  <div v-if="error" role="alert" class="flex items-start gap-4 rounded-[6px] border-2 border-berry-700 bg-berry-100 p-5">
    <PixelSprite name="heart" :scale="2" />
    <div>
      <p class="font-bold">Could not load this page.</p>
      <p class="text-sm text-ink-soft">{{ errorMessage(error) }}</p>
      <p class="mt-1 text-sm text-ink-soft">Your data is still safe on this computer. Try reopening the app.</p>
    </div>
  </div>
  <div v-else-if="loading" class="flex items-center gap-3 py-10 text-ink-soft" aria-live="polite">
    <PixelSprite name="dumbbell" :scale="2" class="animate-bob" />
    <span class="pixel-label">Loading…</span>
  </div>
  <slot v-else />
</template>
