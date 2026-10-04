<script setup lang="ts">
import PixelSprite from './pixel/PixelSprite.vue'
import type { SpriteName } from './pixel/sprites'

withDefaults(defineProps<{ title: string; text?: string; sprite?: SpriteName; compact?: boolean }>(), { sprite: 'mascot' })
</script>

<template>
  <div
    class="flex flex-col items-center rounded-[6px] border-2 border-dashed border-cream-400 text-center"
    :class="compact ? 'gap-2 px-6 py-8' : 'gap-3 px-8 py-14'"
  >
    <PixelSprite :name="sprite" :scale="compact ? 3 : 4" class="animate-bob" />
    <h2 class="pixel-title mt-2 text-lg">{{ title }}</h2>
    <p v-if="text" class="max-w-md text-ink-soft">{{ text }}</p>
    <div v-if="$slots.default" class="mt-3 flex flex-wrap justify-center gap-3">
      <slot />
    </div>
  </div>
</template>
