<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class']; invalid?: boolean }>()
const model = defineModel<string | number>()
</script>

<template>
  <input
    v-model="model"
    :aria-invalid="invalid || undefined"
    :class="
      cn(
        'h-10 w-full min-w-0 rounded-[5px] border-2 border-ink bg-paper px-3 text-[15px] text-ink',
        'shadow-[inset_2px_2px_0_0_var(--color-cream-200)] placeholder:text-ink-faint',
        'focus-visible:outline-3 focus-visible:outline-sky-700 focus-visible:outline-offset-1',
        'disabled:opacity-50 aria-[invalid=true]:border-berry-700 aria-[invalid=true]:bg-berry-100',
        props.class
      )
    "
  />
</template>
