<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import QueryState from '@/components/QueryState.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import PixelSprite from '@/components/pixel/PixelSprite.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Label from '@/components/ui/label/Label.vue'
import NativeSelect from '@/components/ui/native-select/NativeSelect.vue'
import { useAction } from '@/composables/useAction'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useToast } from '@/composables/useToast'
import { db } from '@/lib/db'
import {
  addDays,
  formatDate,
  formatMonth,
  parseDateKey,
  startOfWeek,
  todayKey,
  WEEKDAY_NAMES,
  WEEKDAY_ORDER,
  WEEKDAY_SHORT,
  weekdayOf
} from '@/lib/dates'
import { loadSchedule, resolveDayPlan, setDateOverride, setWeeklyDay, type PlanChoice } from '@/lib/repo/schedule'
import { startSession } from '@/lib/repo/sessions'
import type { DateKey } from '@/lib/types'

const router = useRouter()
const toast = useToast()
const today = todayKey()

const { data, loading, error } = useLiveQuery(async () => {
  const [schedule, sessions] = await Promise.all([loadSchedule(), db.sessions.where('status').equals('completed').toArray()])
  schedule.routines.sort((a, b) => a.name.localeCompare(b.name))
  return { schedule, sessions }
})

// ---- weekly plan -----------------------------------------------------------
function weeklyValue(weekday: number): string {
  const entry = data.value?.schedule.weekly.find((w) => w.weekday === weekday)
  if (!entry) return 'none'
  if (entry.kind === 'rest') return 'rest'
  return entry.routineId && data.value?.schedule.routines.some((r) => r.id === entry.routineId) ? `r:${entry.routineId}` : 'none'
}

function toChoice(value: string): PlanChoice {
  if (value === 'rest') return { kind: 'rest' }
  if (value.startsWith('r:')) return { kind: 'routine', routineId: value.slice(2) }
  return { kind: 'none' }
}

const savedDay = ref<number | null>(null)
const setWeekly = useAction(async (weekday: number, value: string) => {
  await setWeeklyDay(weekday, toChoice(value))
  savedDay.value = weekday
  setTimeout(() => {
    if (savedDay.value === weekday) savedDay.value = null
  }, 1500)
})

// ---- calendar --------------------------------------------------------------
const month = ref(today.slice(0, 7))
function shiftMonth(delta: number) {
  const [y, m] = month.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const calendar = computed(() => {
  if (!data.value) return []
  const first = `${month.value}-01`
  const start = startOfWeek(first)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i)
    if (i >= 35 && !date.startsWith(month.value)) break
    cells.push({
      date,
      inMonth: date.startsWith(month.value),
      day: parseDateKey(date).getDate(),
      plan: resolveDayPlan(date, data.value.schedule),
      done: data.value.sessions.filter((s) => s.date === date)
    })
  }
  return cells
})

// ---- date dialog -----------------------------------------------------------
const dayOpen = ref(false)
const selectedDate = ref<DateKey>(today)
const overrideValue = ref('weekly')

const selectedInfo = computed(() => {
  if (!data.value) return null
  const weekdayEntry = data.value.schedule.weekly.find((w) => w.weekday === weekdayOf(selectedDate.value))
  const override = data.value.schedule.overrides.find((o) => o.date === selectedDate.value)
  const weeklyPlan = resolveDayPlan(selectedDate.value, { ...data.value.schedule, overrides: [] })
  return {
    weekdayEntry,
    override,
    weeklyLabel: weeklyPlan.kind === 'routine' ? weeklyPlan.routineName : weeklyPlan.kind === 'rest' ? 'Rest day' : 'Nothing planned',
    plan: resolveDayPlan(selectedDate.value, data.value.schedule),
    sessions: data.value.sessions.filter((s) => s.date === selectedDate.value)
  }
})

function openDay(date: DateKey) {
  selectedDate.value = date
  const override = data.value?.schedule.overrides.find((o) => o.date === date)
  overrideValue.value = !override ? 'weekly' : override.kind === 'rest' ? 'rest' : `r:${override.routineId}`
  dayOpen.value = true
}

const saveOverride = useAction(async () => {
  const choice = overrideValue.value === 'weekly' ? null : (toChoice(overrideValue.value) as Exclude<PlanChoice, { kind: 'none' }>)
  await setDateOverride(selectedDate.value, choice)
  toast.success(choice ? `Changed the plan for ${formatDate(selectedDate.value, 'short')}` : 'Back to the weekly plan')
  dayOpen.value = false
})

const startToday = useAction(async (routineId: string) => {
  await startSession({ routineId })
  dayOpen.value = false
  await router.push('/workout')
})

const upcomingOverrides = computed(() =>
  (data.value?.schedule.overrides ?? []).filter((o) => o.date >= today).sort((a, b) => a.date.localeCompare(b.date))
)
function routineName(id: string | null) {
  return data.value?.schedule.routines.find((r) => r.id === id)?.name ?? 'Deleted routine'
}
</script>

<template>
  <PageHeader title="Schedule" subtitle="Plan a typical week, then tweak single days when life happens." sprite="calendar" />

  <QueryState :loading="loading" :error="error">
    <template v-if="data">
      <div
        v-if="!data.schedule.routines.length"
        class="mb-8 flex flex-wrap items-center gap-4 rounded-[6px] border-2 border-dashed border-cream-400 p-5"
      >
        <PixelSprite name="clipboard" :scale="2" />
        <p class="flex-1 text-ink-soft">You can mark rest days now. To plan workouts, create a routine first.</p>
        <Button as-child size="sm" variant="accent"><RouterLink to="/routines/new">New routine</RouterLink></Button>
      </div>

      <div class="grid gap-x-12 gap-y-12 xl:grid-cols-[320px_minmax(0,1fr)]">
        <!-- Weekly plan -->
        <section aria-labelledby="weekly-heading">
          <h2 id="weekly-heading" class="pixel-label mb-3">Every week</h2>
          <ul class="flex flex-col gap-2.5">
            <li v-for="weekday in WEEKDAY_ORDER" :key="weekday" class="flex items-center gap-3">
              <label :for="`wd-${weekday}`" class="w-24 shrink-0 font-bold" :class="weekday === weekdayOf(today) && 'text-leaf-700'">
                {{ WEEKDAY_NAMES[weekday] }}
              </label>
              <NativeSelect
                :id="`wd-${weekday}`"
                :model-value="weeklyValue(weekday)"
                class="flex-1"
                @update:model-value="(v) => setWeekly.run(weekday, String(v))"
              >
                <option value="none">Nothing planned</option>
                <option value="rest">Rest day</option>
                <optgroup v-if="data.schedule.routines.length" label="Routines">
                  <option v-for="r in data.schedule.routines" :key="r.id" :value="`r:${r.id}`">{{ r.name }}</option>
                </optgroup>
              </NativeSelect>
              <span class="w-4 text-leaf-700" aria-live="polite">
                <PixelGlyph v-if="savedDay === weekday" name="check" class="animate-pop" />
              </span>
            </li>
          </ul>

          <div v-if="upcomingOverrides.length" class="mt-10">
            <h2 class="pixel-label mb-3">One-off changes</h2>
            <ul class="flex flex-col gap-1">
              <li v-for="o in upcomingOverrides" :key="o.date">
                <button class="flex w-full items-center gap-3 rounded-[4px] px-2 py-1.5 text-left hover:bg-cream-200" @click="openDay(o.date)">
                  <PixelGlyph name="flag" class="text-sun-700" />
                  <span class="num w-28 shrink-0 text-sm">{{ formatDate(o.date, 'short') }}</span>
                  <span class="truncate font-semibold">{{ o.kind === 'rest' ? 'Rest day' : routineName(o.routineId) }}</span>
                </button>
              </li>
            </ul>
          </div>
        </section>

        <!-- Calendar -->
        <section aria-labelledby="calendar-heading">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 id="calendar-heading" class="pixel-title text-lg">{{ formatMonth(month) }}</h2>
            <div class="flex items-center gap-2">
              <Button size="icon-sm" variant="secondary" aria-label="Previous month" @click="shiftMonth(-1)"><PixelGlyph name="left" /></Button>
              <Button size="sm" variant="secondary" @click="month = today.slice(0, 7)">Today</Button>
              <Button size="icon-sm" variant="secondary" aria-label="Next month" @click="shiftMonth(1)"><PixelGlyph name="right" /></Button>
            </div>
          </div>

          <div class="grid grid-cols-7 gap-1.5" role="grid" :aria-label="formatMonth(month)">
            <div v-for="d in WEEKDAY_ORDER" :key="d" class="pixel-label pb-1 text-center" role="columnheader">{{ WEEKDAY_SHORT[d] }}</div>
            <button
              v-for="cell in calendar"
              :key="cell.date"
              role="gridcell"
              class="relative flex min-h-[84px] flex-col items-start gap-1 rounded-[5px] border-2 p-1.5 text-left transition-colors"
              :class="[
                cell.date === today ? 'border-ink bg-paper shadow-pixel-sm' : 'border-cream-300 bg-cream-100 hover:border-ink',
                !cell.inMonth && 'opacity-45'
              ]"
              :aria-label="`${formatDate(cell.date)}. ${cell.done.length ? `${cell.done.length} completed` : ''} ${cell.plan.kind === 'routine' ? `Planned: ${cell.plan.routineName}` : cell.plan.kind === 'rest' ? 'Rest day' : ''}`"
              @click="openDay(cell.date)"
            >
              <span class="num text-sm font-extrabold" :class="cell.date === today && 'text-leaf-700'">{{ cell.day }}</span>
              <PixelGlyph v-if="cell.plan.source === 'override'" name="flag" :size="8" class="absolute right-1.5 top-2 text-sun-700" />
              <span
                v-for="s in cell.done"
                :key="s.id"
                class="flex w-full items-center gap-1 truncate rounded-[3px] border-2 border-ink bg-leaf-500 px-1 text-[11px] font-bold leading-4"
              >
                <PixelGlyph name="check" :size="8" class="shrink-0" /> <span class="truncate">{{ s.routineName }}</span>
              </span>
              <span
                v-if="!cell.done.length && cell.plan.kind === 'routine'"
                class="w-full truncate rounded-[3px] border-2 border-dashed px-1 text-[11px] font-bold leading-4"
                :class="cell.date < today ? 'border-cream-400 text-ink-faint' : 'border-sky-700 text-sky-700'"
              >
                {{ cell.plan.routineName }}
              </span>
              <PixelSprite v-if="!cell.done.length && cell.plan.kind === 'rest'" name="moon" :scale="1" class="opacity-70" />
            </button>
          </div>

          <ul class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft" aria-label="Legend">
            <li class="flex items-center gap-2">
              <span class="h-3.5 w-6 rounded-[3px] border-2 border-dashed border-sky-700" /> Planned
            </li>
            <li class="flex items-center gap-2"><span class="h-3.5 w-6 rounded-[3px] border-2 border-ink bg-leaf-500" /> Completed</li>
            <li class="flex items-center gap-2"><PixelSprite name="moon" :scale="1" /> Rest day</li>
            <li class="flex items-center gap-2"><PixelGlyph name="flag" :size="8" class="text-sun-700" /> Changed for that date</li>
          </ul>
        </section>
      </div>
    </template>
  </QueryState>

  <Dialog v-model:open="dayOpen">
    <DialogContent v-if="selectedInfo">
      <DialogHeader>
        <DialogTitle>{{ formatDate(selectedDate, 'long') }}</DialogTitle>
        <DialogDescription>Weekly plan for {{ WEEKDAY_NAMES[weekdayOf(selectedDate)] }}s: {{ selectedInfo.weeklyLabel }}</DialogDescription>
      </DialogHeader>

      <div v-if="selectedInfo.sessions.length" class="mb-5">
        <p class="pixel-label mb-2">Completed</p>
        <ul class="flex flex-col gap-1">
          <li v-for="s in selectedInfo.sessions" :key="s.id">
            <RouterLink :to="`/history/${s.id}`" class="flex items-center gap-2 font-bold text-leaf-700 hover:underline" @click="dayOpen = false">
              <PixelGlyph name="check" /> {{ s.routineName }}
            </RouterLink>
          </li>
        </ul>
      </div>

      <form class="flex flex-col gap-1.5" @submit.prevent="saveOverride.run()">
        <Label for="override">Plan for this date only</Label>
        <NativeSelect id="override" v-model="overrideValue">
          <option value="weekly">Follow the weekly plan ({{ selectedInfo.weeklyLabel }})</option>
          <option value="rest">Rest day</option>
          <optgroup v-if="data?.schedule.routines.length" label="Routines">
            <option v-for="r in data?.schedule.routines" :key="r.id" :value="`r:${r.id}`">{{ r.name }}</option>
          </optgroup>
        </NativeSelect>
        <p class="text-sm text-ink-soft">This won't change your other {{ WEEKDAY_NAMES[weekdayOf(selectedDate)] }}s.</p>

        <DialogFooter>
          <Button
            v-if="selectedDate === today && selectedInfo.plan.kind === 'routine'"
            variant="accent"
            class="mr-auto"
            :disabled="startToday.pending.value"
            @click="startToday.run(selectedInfo.plan.routineId)"
          >
            <PixelGlyph name="play" /> Start now
          </Button>
          <Button variant="secondary" @click="dayOpen = false">Cancel</Button>
          <Button type="submit" :disabled="saveOverride.pending.value">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
