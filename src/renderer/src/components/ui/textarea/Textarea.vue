<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
const model = defineModel<string>()
</script>

<template>
  <textarea
    v-model="model"
    :class="
      cn(
        'min-h-20 w-full rounded-[5px] border-2 border-ink bg-paper px-3 py-2 text-[15px] text-ink',
        'shadow-[inset_2px_2px_0_0_var(--color-cream-200)] placeholder:text-ink-faint resize-y',
        'focus-visible:outline-3 focus-visible:outline-sky-700 focus-visible:outline-offset-1',
        props.class
      )
    "
  />
</template>
