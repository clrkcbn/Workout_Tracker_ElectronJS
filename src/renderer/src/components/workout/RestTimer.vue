<script setup lang="ts">
import { computed } from 'vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import PixelSprite from '@/components/pixel/PixelSprite.vue'
import { Button } from '@/components/ui/button'
import { useRestTimer } from '@/composables/useRestTimer'
import { usePreferences } from '@/composables/usePreferences'
import { formatClock } from '@/lib/dates'

const timer = useRestTimer()
const { prefs } = usePreferences()

const SEGMENTS = 20
const filled = computed(() => Math.round(Math.min(1, Math.max(0, timer.progress.value)) * SEGMENTS))
const paused = computed(() => !timer.running.value && timer.state.remainingMs > 0 && timer.state.remainingMs < timer.state.durationMs)

</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[6px] border-2 border-ink px-4 py-3 shadow-pixel"
    :class="timer.justFinished.value ? 'bg-sun-300 animate-shake' : 'bg-sky-100'"
    role="timer"
    aria-label="Rest timer"
  >
    <PixelSprite name="stopwatch" :scale="2" :class="timer.running.value && 'animate-bob'" />
    <div class="min-w-[110px]">
      <p class="pixel-label">
        <template v-if="timer.justFinished.value">Rest over — go!</template>
        <template v-else-if="timer.running.value">Resting{{ timer.state.label ? ` · ${timer.state.label}` : '' }}</template>
        <template v-else-if="paused">Paused</template>
        <template v-else>Rest timer</template>
      </p>
      <p class="num text-3xl font-extrabold leading-none" aria-live="off">{{ formatClock(timer.remainingSeconds.value) }}</p>
    </div>

    <div class="hidden min-w-[120px] flex-1 gap-[3px] sm:flex" aria-hidden="true">
      <span v-for="i in SEGMENTS" :key="i" class="h-3 flex-1 border-2 border-ink" :class="i <= filled ? 'bg-sky-700' : 'bg-paper'" />
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" aria-label="Subtract 15 seconds" @click="timer.adjust(-15)">−15s</Button>
      <Button size="sm" variant="secondary" aria-label="Add 15 seconds" @click="timer.adjust(15)">+15s</Button>
      <Button v-if="timer.running.value" size="sm" variant="sky" @click="timer.pause()"><PixelGlyph name="pause" /> Pause</Button>
      <Button v-else-if="paused" size="sm" variant="sky" @click="timer.resume()"><PixelGlyph name="play" /> Resume</Button>
      <Button v-else size="sm" variant="sky" @click="timer.start(timer.state.durationMs / 1000 || prefs.defaultRestSeconds)">
        <PixelGlyph name="play" /> Start
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Reset timer" @click="timer.reset()"><PixelGlyph name="reset" /></Button>
    </div>
  </div>
</template>
