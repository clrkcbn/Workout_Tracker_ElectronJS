<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import PixelSprite from '@/components/pixel/PixelSprite.vue'
import type { SpriteName } from '@/components/pixel/sprites'
import ToastHost from '@/components/ToastHost.vue'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { usePreferences } from '@/composables/usePreferences'
import { playChime, useRestTimer } from '@/composables/useRestTimer'
import { formatDuration } from '@/lib/dates'
import { getActiveSession } from '@/lib/repo/sessions'

const route = useRoute()
const scroller = ref<HTMLElement | null>(null)
const { prefs } = usePreferences()
const { data: active } = useLiveQuery(getActiveSession)

// The rest timer is app-wide, so its chime lives here rather than on the workout screen.
useRestTimer().onFinish(() => {
  if (prefs.timerSound) playChime()
})

const nav: Array<{ to: string; label: string; sprite: SpriteName; match: string[] }> = [
  { to: '/', label: 'Today', sprite: 'sun', match: ['today'] },
  { to: '/workout', label: 'Workout', sprite: 'stopwatch', match: ['workout'] },
  { to: '/routines', label: 'Routines', sprite: 'clipboard', match: ['routines', 'routine-new', 'routine-edit'] },
  { to: '/schedule', label: 'Schedule', sprite: 'calendar', match: ['schedule'] },
  { to: '/exercises', label: 'Exercises', sprite: 'dumbbell', match: ['exercises'] },
  { to: '/history', label: 'History', sprite: 'book', match: ['history', 'session'] },
  { to: '/progress', label: 'Progress', sprite: 'chart', match: ['progress'] },
  { to: '/settings', label: 'Settings', sprite: 'gear', match: ['settings'] }
]

const now = ref(Date.now())
const clock = window.setInterval(() => (now.value = Date.now()), 30_000)
onBeforeUnmount(() => window.clearInterval(clock))
const elapsed = computed(() => (active.value ? formatDuration(now.value - active.value.startedAt) : ''))

watch(
  () => route.fullPath,
  () => scroller.value?.scrollTo({ top: 0 })
)
</script>

<template>
  <div class="flex h-full">
    <aside class="flex w-[212px] shrink-0 flex-col border-r-2 border-ink bg-cream-200 max-[980px]:w-[76px]">
      <div class="flex items-center gap-3 px-5 pb-5 pt-6 max-[980px]:justify-center max-[980px]:px-2">
        <PixelSprite name="mascot" :scale="2" label="Pixel Gym Journal" />
        <div class="max-[980px]:hidden">
          <p class="pixel-title text-[15px] leading-tight">Gym<br />Journal</p>
        </div>
      </div>

      <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label="Main">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :title="item.label"
          class="group flex h-11 items-center gap-3 rounded-[5px] border-2 px-2.5 font-bold text-ink-soft transition-colors max-[980px]:justify-center max-[980px]:px-0"
          :class="
            item.match.includes(String(route.name))
              ? 'border-ink bg-paper text-ink shadow-pixel-sm'
              : 'border-transparent hover:bg-cream-100 hover:text-ink'
          "
        >
          <PixelSprite :name="item.sprite" :scale="2" class="transition-transform group-hover:-translate-y-px" />
          <span class="max-[980px]:hidden">{{ item.label }}</span>
          <span
            v-if="item.to === '/workout' && active"
            class="ml-auto h-2.5 w-2.5 animate-sparkle bg-berry-500 outline-2 outline-ink max-[980px]:hidden"
            aria-label="Workout in progress"
          />
        </RouterLink>
      </nav>

      <div class="p-3">
        <RouterLink
          v-if="active && route.name !== 'workout'"
          to="/workout"
          class="block rounded-[5px] border-2 border-ink bg-sun-300 p-3 shadow-pixel-sm hover:bg-sun-500 max-[980px]:p-2 max-[980px]:text-center"
        >
          <p class="pixel-label !text-ink max-[980px]:hidden">In progress</p>
          <p class="truncate font-bold max-[980px]:hidden">{{ active.routineName }}</p>
          <p class="num text-sm text-ink-soft max-[980px]:text-xs">{{ elapsed }}</p>
        </RouterLink>
        <p v-else class="pixel-label px-2 text-center max-[980px]:px-0">Units: {{ prefs.unit }}</p>
      </div>
    </aside>

    <main ref="scroller" class="min-w-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-[1080px] px-10 py-9 max-[980px]:px-6 max-[980px]:py-7">
        <RouterView />
      </div>
    </main>
  </div>
  <ToastHost />
</template>
