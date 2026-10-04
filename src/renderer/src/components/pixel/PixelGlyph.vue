<script setup lang="ts">
import { computed } from 'vue'
import { glyphRows, toRuns, type GlyphName } from './sprites'

const props = withDefaults(defineProps<{ name: GlyphName; size?: number }>(), { size: 16 })
const runs = computed(() => toRuns(glyphRows(props.name)))
</script>

<template>
  <svg class="pixelated inline-block shrink-0" :width="size" :height="size" viewBox="0 0 8 8" aria-hidden="true" fill="currentColor">
    <rect v-for="(r, i) in runs" :key="i" :x="r.x" :y="r.y" :width="r.w" height="1" />
  </svg>
</template>
