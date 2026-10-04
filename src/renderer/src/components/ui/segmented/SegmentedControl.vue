<script setup lang="ts" generic="T extends string">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'

defineProps<{ options: Array<{ value: T; label: string }>; label: string; disabled?: boolean }>()
const model = defineModel<T>({ required: true })

function onUpdate(value: unknown) {
  // Toggle groups allow deselecting; a segmented control always keeps one choice.
  if (typeof value === 'string' && value) model.value = value as T
}
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="model"
    :aria-label="label"
    :disabled="disabled"
    class="inline-flex gap-1 rounded-[6px] border-2 border-ink bg-cream-200 p-1"
    @update:model-value="onUpdate"
  >
    <ToggleGroupItem
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      class="h-9 min-w-14 rounded-[4px] px-3 text-sm font-bold text-ink-soft hover:text-ink data-[state=on]:bg-sun-500 data-[state=on]:text-ink data-[state=on]:shadow-pixel-sm data-[state=on]:outline-2 data-[state=on]:outline-ink"
    >
      {{ option.label }}
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
