<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'

const props = defineProps<{ class?: HTMLAttributes['class']; invalid?: boolean }>()
defineOptions({ inheritAttrs: false })
const model = defineModel<string>()
</script>

<template>
  <div :class="cn('relative', props.class)">
    <select
      v-bind="$attrs"
      v-model="model"
      :aria-invalid="invalid || undefined"
      class="h-10 w-full appearance-none rounded-[5px] border-2 border-ink bg-paper pl-3 pr-9 text-[15px] text-ink shadow-pixel-sm focus-visible:outline-3 focus-visible:outline-sky-700 focus-visible:outline-offset-1 disabled:opacity-50 aria-[invalid=true]:border-berry-700"
    >
      <slot />
    </select>
    <PixelGlyph name="down" :size="16" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink" />
  </div>
</template>
