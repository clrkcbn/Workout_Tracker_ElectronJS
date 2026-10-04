<script setup lang="ts">
import { computed } from 'vue'
import { PALETTE, spriteRows, toRuns, type SpriteName } from './sprites'

const props = withDefaults(defineProps<{ name: SpriteName; scale?: number; label?: string }>(), { scale: 2 })

const rows = computed(() => spriteRows(props.name))
const width = computed(() => rows.value[0].length)
const height = computed(() => rows.value.length)
const runs = computed(() => toRuns(rows.value))
</script>

<template>
  <svg
    class="pixelated inline-block shrink-0"
    :width="width * scale"
    :height="height * scale"
    :viewBox="`0 0 ${width} ${height}`"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <rect v-for="(r, i) in runs" :key="i" :x="r.x" :y="r.y" :width="r.w" height="1" :fill="PALETTE[r.c]" />
  </svg>
</template>
