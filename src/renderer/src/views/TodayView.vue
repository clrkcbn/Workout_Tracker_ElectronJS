<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryState from '@/components/QueryState.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import PixelSprite from '@/components/pixel/PixelSprite.vue'
import { Button } from '@/components/ui/button'
import { useAction } from '@/composables/useAction'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { usePreferences } from '@/composables/usePreferences'
import { db } from '@/lib/db'
import { formatDate, parseDateKey, todayKey, WEEKDAY_SHORT, weekDates, weekdayOf } from '@/lib/dates'
import { addStarterLibrary } from '@/lib/repo/exercises'
import { listRoutines } from '@/lib/repo/routines'
import { loadSchedule, resolveDayPlan } from '@/lib/repo/schedule'
import { getActiveSession, loadCompletedHistory, startSession } from '@/lib/repo/sessions'
import { buildExerciseHistories, computeRecords, RECORD_LABELS } from '@/lib/stats'
import { plural } from '@/lib/utils'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const toast = useToast()
const { fmtWeight } = usePreferences()
const today = todayKey()

const { data, loading, error } = useLiveQuery(async () => {
  const [schedule, routines, active, history, exerciseCount] = await Promise.all([
    loadSchedule(),
    listRoutines(),
    getActiveSession(),
    loadCompletedHistory(),
    db.exercises.count()
  ])
  const records = computeRecords(buildExerciseHistories(history))
  return { schedule, routines, active, history, exerciseCount, recentRecords: records.events.slice(0, 4) }
})

const plan = computed(() => (data.value ? resolveDayPlan(today, data.value.schedule) : null))
const plannedRoutine = computed(() => {
  const p = plan.value
  return p?.kind === 'routine' ? data.value?.routines.find((r) => r.id === p.routineId) : undefined
})
const completedToday = computed(() => data.value?.history.sessions.filter((s) => s.date === today) ?? [])

const week = computed(() => {
  if (!data.value) return []
  const d = data.value
  return weekDates(today).map((date) => ({
    date,
    label: WEEKDAY_SHORT[weekdayOf(date)],
    day: parseDateKey(date).getDate(),
    plan: resolveDayPlan(date, d.schedule),
    done: d.history.sessions.filter((s) => s.date === date).length,
    isToday: date === today,
    isPast: date < today
  }))
})
const weekDone = computed(() => week.value.reduce((n, d) => n + d.done, 0))
const weekPlanned = computed(() => week.value.filter((d) => d.plan.kind === 'routine').length)

const greeting = computed(() => {
  if (data.value?.active) return 'Back to it!'
  if (completedToday.value.length) return 'Nice work today'
  if (plan.value?.kind === 'rest') return 'Rest & recharge'
  if (plannedRoutine.value) return `${plannedRoutine.value.name} day`
  return 'Ready when you are'
})

const start = useAction(async (routineId: string | null) => {
  const result = await startSession({ routineId })
  if (result.resumed) toast.info('You already have a workout going', 'Picking up where you left off.')
  await router.push('/workout')
})

const starter = useAction(async () => {
  const added = await addStarterLibrary()
  toast.success(`Added ${plural(added, 'exercise')}`, 'Edit or delete any of them in the Exercises tab.')
})
</script>

<template>
  <PageHeader :eyebrow="formatDate(today, 'long')" :title="greeting" />

  <QueryState :loading="loading" :error="error">
    <template v-if="data">
      <!-- First-run guide -->
      <EmptyState
        v-if="!data.routines.length && !data.history.sessions.length && !data.active"
        title="Let's set up your journal"
        text="Add a few exercises, bundle them into a routine, then pin it to days of the week. Or just start a free workout and log as you go."
        class="mb-10"
      >
        <Button v-if="!data.exerciseCount" variant="accent" :disabled="starter.pending.value" @click="starter.run()">
          <PixelGlyph name="plus" /> Add starter exercises
        </Button>
        <Button v-else as-child variant="accent"><RouterLink to="/routines/new">Build a routine</RouterLink></Button>
        <Button variant="secondary" :disabled="start.pending.value" @click="start.run(null)">Start a free workout</Button>
      </EmptyState>

      <div class="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <!-- Today's plan -->
        <section aria-labelledby="plan-heading">
          <h2 id="plan-heading" class="pixel-label mb-3">Today's plan</h2>
          <div class="pixel-box p-6">
            <!-- Active session -->
            <div v-if="data.active" class="flex flex-wrap items-center gap-5">
              <PixelSprite name="stopwatch" :scale="3" class="animate-bob" />
              <div class="min-w-0 flex-1">
                <p class="pixel-title text-xl">{{ data.active.routineName }}</p>
                <p class="text-ink-soft">Workout in progress — everything you've logged is saved.</p>
              </div>
              <Button size="lg" variant="accent" @click="router.push('/workout')"><PixelGlyph name="play" /> Resume workout</Button>
            </div>

            <!-- Planned routine -->
            <div v-else-if="plannedRoutine">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="pixel-title text-xl">{{ plannedRoutine.name }}</p>
                  <p class="text-ink-soft">
                    {{ plural(plannedRoutine.items.length, 'exercise') }}
                    <span v-if="plan?.source === 'override'"> · changed just for today</span>
                  </p>
                </div>
                <PixelSprite name="dumbbell" :scale="3" />
              </div>
              <ol v-if="plannedRoutine.items.length" class="mt-4 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                <li v-for="(item, i) in plannedRoutine.items.slice(0, 8)" :key="item.id" class="flex items-baseline gap-2">
                  <span class="num w-5 shrink-0 text-right text-sm text-ink-faint">{{ i + 1 }}.</span>
                  <span class="truncate font-semibold">{{ item.exercise?.name ?? 'Deleted exercise' }}</span>
                  <span class="num ml-auto shrink-0 text-sm text-ink-soft">
                    {{ item.targetSets }} × {{ item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}` }}
                  </span>
                </li>
              </ol>
              <p v-if="plannedRoutine.items.length > 8" class="mt-1 text-sm text-ink-faint">
                + {{ plannedRoutine.items.length - 8 }} more
              </p>
              <div class="mt-6 flex flex-wrap items-center gap-4">
                <Button size="lg" :disabled="start.pending.value" @click="start.run(plannedRoutine.id)">
                  <PixelGlyph name="play" /> Start workout
                </Button>
                <span v-if="completedToday.length" class="flex items-center gap-2 text-sm text-leaf-700">
                  <PixelGlyph name="check" /> Already logged {{ plural(completedToday.length, 'workout') }} today
                </span>
              </div>
            </div>

            <!-- Rest day -->
            <div v-else-if="plan?.kind === 'rest'" class="flex flex-wrap items-center gap-5">
              <PixelSprite name="moon" :scale="3" />
              <div class="min-w-0 flex-1">
                <p class="pixel-title text-xl">Rest day</p>
                <p class="text-ink-soft">Muscles grow while you recover. Stretch, walk, hydrate.</p>
              </div>
              <Button variant="secondary" :disabled="start.pending.value" @click="router.push('/workout')">Train anyway</Button>
            </div>

            <!-- Nothing planned -->
            <div v-else class="flex flex-wrap items-center gap-5">
              <PixelSprite name="calendar" :scale="3" />
              <div class="min-w-0 flex-1">
                <p class="pixel-title text-xl">Nothing planned</p>
                <p class="text-ink-soft">
                  <template v-if="completedToday.length">You already trained today. Great job!</template>
                  <template v-else>Pick a routine or start a free workout.</template>
                </p>
              </div>
              <Button size="lg" :disabled="start.pending.value" @click="router.push('/workout')">
                <PixelGlyph name="play" /> Start workout
              </Button>
            </div>
          </div>

          <!-- Week strip -->
          <div class="mt-10 flex items-baseline justify-between">
            <h2 class="pixel-label">This week</h2>
            <RouterLink to="/schedule" class="text-sm font-bold text-sky-700 hover:underline">Edit schedule</RouterLink>
          </div>
          <ol class="mt-3 grid grid-cols-7 gap-2">
            <li
              v-for="day in week"
              :key="day.date"
              class="flex flex-col items-center gap-1.5 rounded-[5px] border-2 px-1 py-3"
              :class="day.isToday ? 'border-ink bg-paper shadow-pixel-sm' : 'border-transparent'"
              :aria-label="`${formatDate(day.date)}: ${day.done ? 'completed' : day.plan.kind === 'routine' ? `planned ${day.plan.routineName}` : day.plan.kind === 'rest' ? 'rest day' : 'nothing planned'}`"
            >
              <span class="pixel-label" :class="day.isToday && '!text-ink'">{{ day.label }}</span>
              <span class="num text-lg font-extrabold" :class="day.isPast && !day.isToday ? 'text-ink-faint' : ''">{{ day.day }}</span>
              <span class="grid h-8 place-items-center">
                <span v-if="day.done" class="grid h-7 w-7 place-items-center rounded-[4px] border-2 border-ink bg-leaf-500" title="Completed">
                  <PixelGlyph name="check" />
                </span>
                <PixelSprite v-else-if="day.plan.kind === 'routine'" name="dumbbell" :scale="2" :class="day.isPast && !day.isToday && 'opacity-40'" />
                <PixelSprite v-else-if="day.plan.kind === 'rest'" name="moon" :scale="2" class="opacity-70" />
                <span v-else class="h-1 w-3 bg-cream-400" />
              </span>
              <span class="h-4 max-w-full truncate px-1 text-[11px] text-ink-soft">
                {{ day.plan.kind === 'routine' ? day.plan.routineName : '' }}
              </span>
            </li>
          </ol>
        </section>

        <!-- Summaries -->
        <aside class="flex flex-col gap-10">
          <section>
            <h2 class="pixel-label mb-3">Workouts this week</h2>
            <p class="flex items-baseline gap-2">
              <span class="num text-5xl font-extrabold">{{ weekDone }}</span>
              <span class="text-ink-soft">
                <template v-if="weekPlanned">of {{ weekPlanned }} planned</template>
                <template v-else>completed</template>
              </span>
            </p>
            <div v-if="weekPlanned" class="mt-3 flex gap-1.5" aria-hidden="true">
              <span
                v-for="i in Math.max(weekPlanned, weekDone)"
                :key="i"
                class="h-4 flex-1 border-2 border-ink"
                :class="i <= weekDone ? 'bg-leaf-500' : 'bg-cream-200'"
              />
            </div>
          </section>

          <section>
            <div class="mb-3 flex items-baseline justify-between">
              <h2 class="pixel-label">Recent records</h2>
              <RouterLink to="/progress" class="text-sm font-bold text-sky-700 hover:underline">All progress</RouterLink>
            </div>
            <ul v-if="data.recentRecords.length" class="flex flex-col gap-3">
              <li v-for="r in data.recentRecords" :key="`${r.sessionId}-${r.exerciseId}-${r.type}`" class="flex items-start gap-3">
                <PixelSprite name="trophy" :scale="2" class="mt-0.5" />
                <div class="min-w-0">
                  <p class="truncate font-bold">{{ r.exerciseName }}</p>
                  <p class="text-sm text-ink-soft">
                    {{ RECORD_LABELS[r.type] }}:
                    <strong class="num text-ink">{{ r.type === 'reps' ? `${r.value} reps` : fmtWeight(r.value) }}</strong>
                    · {{ formatDate(r.date, 'short') }}
                  </p>
                </div>
              </li>
            </ul>
            <p v-else class="text-sm text-ink-soft">
              Records appear once you beat an earlier session of the same exercise. Keep logging!
            </p>
          </section>
        </aside>
      </div>
    </template>
  </QueryState>
</template>
