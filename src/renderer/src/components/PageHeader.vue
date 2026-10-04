<script setup lang="ts">
import PixelSprite from './pixel/PixelSprite.vue'
import type { SpriteName } from './pixel/sprites'

defineProps<{ title: string; subtitle?: string; sprite?: SpriteName; eyebrow?: string }>()
</script>

<template>
  <header class="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
    <div class="flex min-w-0 items-center gap-4">
      <PixelSprite v-if="sprite" :name="sprite" :scale="3" class="hidden sm:inline-block" />
      <div class="min-w-0">
        <p v-if="eyebrow" class="pixel-label mb-1">{{ eyebrow }}</p>
        <h1 class="pixel-title text-[26px] text-ink">{{ title }}</h1>
        <p v-if="subtitle" class="mt-1 text-ink-soft">{{ subtitle }}</p>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
