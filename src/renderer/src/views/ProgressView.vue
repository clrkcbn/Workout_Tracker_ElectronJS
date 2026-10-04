<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { TabsContent } from 'reka-ui'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryState from '@/components/QueryState.vue'
import TrendChart, { type TrendSeries } from '@/components/TrendChart.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import PixelSprite from '@/components/pixel/PixelSprite.vue'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import NativeSelect from '@/components/ui/native-select/NativeSelect.vue'
import SegmentedControl from '@/components/ui/segmented/SegmentedControl.vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAction } from '@/composables/useAction'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { usePreferences } from '@/composables/usePreferences'
import { useToast } from '@/composables/useToast'
import { addDays, dayNumber, formatDate, todayKey } from '@/lib/dates'
import { deleteBodyweight, listBodyweights, saveBodyweight } from '@/lib/repo/bodyweight'
import { loadCompletedHistory } from '@/lib/repo/sessions'
import { buildExerciseHistories, computeRecords, E1RM_MAX_REPS, RECORD_LABELS, recordTypesFor, type CurrentRecord } from '@/lib/stats'
import type { BodyweightEntry } from '@/lib/types'
import { formatNumber, kgToUnit, parseWeightInput } from '@/lib/units'
import { plural } from '@/lib/utils'

const toast = useToast()
const { unit, fmtWeight } = usePreferences()
const tab = ref('exercises')

const { data, loading, error } = useLiveQuery(async () => {
  const [history, bodyweights] = await Promise.all([loadCompletedHistory(), listBodyweights()])
  const histories = buildExerciseHistories(history)
  const records = computeRecords(histories)
  return { histories, records, bodyweights }
})

// ---- range filter -------------------------------------------------------------
type Range = '90' | '180' | '365' | 'all'
const range = ref<Range>('180')
const rangeOptions: Array<{ value: Range; label: string }> = [
  { value: '90', label: '3 mo' },
  { value: '180', label: '6 mo' },
  { value: '365', label: '1 yr' },
  { value: 'all', label: 'All' }
]
const rangeStart = computed(() => (range.value === 'all' ? '0000-00-00' : addDays(todayKey(), -Number(range.value))))
const toUnit = (kg: number) => Math.round(kgToUnit(kg, unit.value) * 100) / 100

// ---- exercises -----------------------------------------------------------------
const exerciseOptions = computed(() =>
  [...(data.value?.histories.values() ?? [])].sort((a, b) => a.name.localeCompare(b.name))
)
const exerciseId = ref('')
watch(
  exerciseOptions,
  (options) => {
    if (!options.some((o) => o.exerciseId === exerciseId.value)) {
      // Default to the most recently trained exercise.
      const latest = [...options].sort((a, b) => (b.points.at(-1)?.order ?? 0) - (a.points.at(-1)?.order ?? 0))[0]
      exerciseId.value = latest?.exerciseId ?? ''
    }
  },
  { immediate: true }
)
const selected = computed(() => data.value?.histories.get(exerciseId.value))
const points = computed(() => selected.value?.points.filter((p) => p.date >= rangeStart.value) ?? [])
const showTable = ref(false)

const weightSeries = computed<TrendSeries[]>(() => {
  const ex = selected.value
  if (!ex) return []
  const top = points.value.filter((p) => p.topWeightKg != null).map((p) => ({ x: dayNumber(p.date), y: toUnit(p.topWeightKg!) }))
  if (ex.isBodyweight) return top.length ? [{ label: 'Heaviest added weight', tone: 'primary', points: top }] : []
  const e1rm = points.value.filter((p) => p.bestE1rmKg != null).map((p) => ({ x: dayNumber(p.date), y: toUnit(p.bestE1rmKg!) }))
  return [
    { label: 'Heaviest set', tone: 'primary', points: top },
    { label: 'Estimated 1RM', tone: 'secondary', points: e1rm }
  ].filter((s) => s.points.length) as TrendSeries[]
})

const repsSeries = computed<TrendSeries[]>(() => {
  const ex = selected.value
  if (!ex) return []
  const best = points.value.map((p) => ({ x: dayNumber(p.date), y: p.bestReps }))
  const total = points.value.map((p) => ({ x: dayNumber(p.date), y: p.totalReps }))
  return ex.isBodyweight
    ? [
        { label: 'Most reps in a set', tone: 'primary', points: best },
        { label: 'Total reps', tone: 'secondary', points: total }
      ]
    : [{ label: 'Total reps', tone: 'primary', points: total }]
})

const currentBests = computed(() => data.value?.records.current.get(exerciseId.value) ?? [])
function recordText(r: CurrentRecord) {
  return r.type === 'reps' ? `${r.value} reps` : fmtWeight(r.value)
}

// ---- records ------------------------------------------------------------------
const allRecords = computed(() =>
  exerciseOptions.value.map((h) => ({
    history: h,
    bests: recordTypesFor(h.isBodyweight).map((type) => data.value?.records.current.get(h.exerciseId)?.find((r) => r.type === type))
  }))
)

// ---- bodyweight ---------------------------------------------------------------
const bwDate = ref(todayKey())
const bwValue = ref('')
const bwError = ref('')
const saveBw = useAction(async () => {
  bwError.value = ''
  const parsed = parseWeightInput(bwValue.value, unit.value, { required: true })
  if (!parsed.ok) return void (bwError.value = parsed.error)
  await saveBodyweight(bwDate.value, parsed.value!)
  toast.success('Bodyweight logged', `${formatDate(bwDate.value, 'short')}: ${fmtWeight(parsed.value)}`)
  bwValue.value = ''
}, { errorTitle: 'Could not save bodyweight' })

const bwInRange = computed(() => (data.value?.bodyweights ?? []).filter((b) => b.date >= rangeStart.value))
const bwSeries = computed<TrendSeries[]>(() =>
  bwInRange.value.length ? [{ label: 'Bodyweight', tone: 'primary', points: bwInRange.value.map((b) => ({ x: dayNumber(b.date), y: toUnit(b.weightKg) })) }] : []
)
const bwChange = computed(() => {
  const list = bwInRange.value
  if (list.length < 2) return null
  return list[list.length - 1].weightKg - list[0].weightKg
})
const bwDeleteTarget = ref<BodyweightEntry | null>(null)
const bwDeleteOpen = ref(false)
const removeBw = useAction(async () => {
  if (bwDeleteTarget.value) await deleteBodyweight(bwDeleteTarget.value.id)
  bwDeleteOpen.value = false
})
</script>

<template>
  <PageHeader title="Progress" subtitle="Trends for one exercise at a time, so comparisons stay honest." sprite="chart" />

  <QueryState :loading="loading" :error="error">
    <Tabs v-if="data" v-model="tab">
      <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
        <TabsList aria-label="Progress views">
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="bodyweight">Bodyweight</TabsTrigger>
        </TabsList>
        <SegmentedControl v-if="tab !== 'records'" v-model="range" :options="rangeOptions" label="Time range" />
      </div>

      <!-- Exercise trends -->
      <TabsContent value="exercises">
        <EmptyState
          v-if="!exerciseOptions.length"
          sprite="chart"
          title="No trends yet"
          text="Finish a workout and your progress charts will start drawing themselves."
        >
          <Button as-child><RouterLink to="/workout">Start a workout</RouterLink></Button>
        </EmptyState>

        <template v-else>
          <div class="mb-8 flex flex-wrap items-end gap-6">
            <div class="flex w-full max-w-sm flex-col gap-1.5">
              <Label for="progress-exercise">Exercise</Label>
              <NativeSelect id="progress-exercise" v-model="exerciseId">
                <option v-for="h in exerciseOptions" :key="h.exerciseId" :value="h.exerciseId">
                  {{ h.name }} ({{ h.points.length }})
                </option>
              </NativeSelect>
            </div>
            <dl v-if="currentBests.length" class="flex flex-wrap gap-x-8 gap-y-3">
              <div v-for="r in currentBests" :key="r.type">
                <dt class="pixel-label">{{ RECORD_LABELS[r.type] }}</dt>
                <dd class="flex items-center gap-2">
                  <PixelSprite name="trophy" :scale="1" />
                  <span class="num text-xl font-extrabold">{{ recordText(r) }}</span>
                  <span class="text-sm text-ink-faint">{{ formatDate(r.date, 'short') }}</span>
                </dd>
              </div>
            </dl>
          </div>

          <p v-if="!points.length" class="rounded-[6px] border-2 border-dashed border-cream-400 p-8 text-center text-ink-soft">
            No sessions of {{ selected?.name }} in this time range. Try a longer range.
          </p>

          <template v-else>
            <p v-if="points.length === 1" class="mb-6 flex items-center gap-2 text-ink-soft">
              <PixelGlyph name="dot" /> One session so far. Log another to see a trend line.
            </p>
            <div class="grid gap-10 xl:grid-cols-2">
              <section v-if="weightSeries.length" class="pixel-box p-5">
                <h2 class="font-extrabold">{{ selected?.isBodyweight ? 'Added weight' : 'Weight' }} <span class="font-normal text-ink-soft">({{ unit }})</span></h2>
                <p class="mb-3 text-sm text-ink-soft">
                  {{ selected?.isBodyweight ? 'Heaviest extra load per session.' : `Heaviest set and best estimated 1RM (Epley, sets of 1–${E1RM_MAX_REPS} reps) per session.` }}
                </p>
                <TrendChart :series="weightSeries" :unit="unit" :label="`${selected?.name} weight trend`" />
              </section>
              <section class="pixel-box p-5">
                <h2 class="font-extrabold">Reps</h2>
                <p class="mb-3 text-sm text-ink-soft">
                  {{ selected?.isBodyweight ? 'Best single set and total reps per session.' : 'Total reps across all sets per session.' }}
                </p>
                <TrendChart :series="repsSeries" unit="reps" :label="`${selected?.name} reps trend`" />
              </section>
            </div>

            <div class="mt-6">
              <Button variant="ghost" size="sm" :aria-expanded="showTable" @click="showTable = !showTable">
                <PixelGlyph :name="showTable ? 'up' : 'down'" /> {{ showTable ? 'Hide' : 'Show' }} data table
              </Button>
              <table v-if="showTable" class="mt-3 w-full max-w-3xl text-left">
                <thead>
                  <tr class="pixel-label">
                    <th class="py-1 font-normal">Date</th>
                    <th class="py-1 font-normal">Sets</th>
                    <th class="py-1 font-normal">{{ selected?.isBodyweight ? 'Added' : 'Heaviest' }} ({{ unit }})</th>
                    <th v-if="!selected?.isBodyweight" class="py-1 font-normal">Est. 1RM ({{ unit }})</th>
                    <th class="py-1 font-normal">Best set reps</th>
                    <th class="py-1 font-normal">Total reps</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in [...points].reverse()" :key="p.sessionId" class="num border-t-2 border-dashed border-cream-300">
                    <td class="py-1.5">
                      <RouterLink :to="`/history/${p.sessionId}`" class="font-bold text-sky-700 hover:underline">{{ formatDate(p.date, 'short') }}</RouterLink>
                    </td>
                    <td class="py-1.5">{{ p.setCount }}</td>
                    <td class="py-1.5">{{ p.topWeightKg != null ? formatNumber(toUnit(p.topWeightKg)) : '—' }}</td>
                    <td v-if="!selected?.isBodyweight" class="py-1.5">{{ p.bestE1rmKg != null ? formatNumber(toUnit(p.bestE1rmKg), 1) : '—' }}</td>
                    <td class="py-1.5">{{ p.bestReps }}</td>
                    <td class="py-1.5">{{ p.totalReps }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>
      </TabsContent>

      <!-- Records -->
      <TabsContent value="records">
        <div class="mb-8 flex gap-4 rounded-[6px] border-2 border-ink bg-sun-100 p-5">
          <PixelSprite name="trophy" :scale="2" class="shrink-0" />
          <div class="text-sm">
            <p class="mb-1 font-extrabold">How records are counted</p>
            <ul class="list-disc space-y-0.5 pl-5 text-ink-soft">
              <li>Only completed sets (1+ reps) from finished workouts count.</li>
              <li><strong class="text-ink">Heaviest weight</strong>: most weight on one set. For bodyweight exercises, the most <em>added</em> weight.</li>
              <li><strong class="text-ink">Best estimated 1RM</strong> (weighted exercises): Epley, weight × (1 + reps ÷ 30), from sets of 1–{{ E1RM_MAX_REPS }} reps.</li>
              <li><strong class="text-ink">Most reps in a set</strong>: bodyweight exercises only.</li>
              <li>A new record must beat the old one — ties don't count. Your first session of an exercise sets the starting point.</li>
            </ul>
          </div>
        </div>

        <EmptyState v-if="!allRecords.length" compact sprite="trophy" title="No records yet" text="Finish a workout to set your first marks." />
        <table v-else class="w-full text-left">
          <thead>
            <tr class="pixel-label">
              <th class="py-2 font-normal">Exercise</th>
              <th class="py-2 font-normal">Record</th>
              <th class="py-2 font-normal">Best</th>
              <th class="py-2 font-normal">Set on</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in allRecords" :key="row.history.exerciseId">
              <tr
                v-for="(best, i) in row.bests"
                :key="i"
                :class="i === 0 ? 'border-t-2 border-dashed border-cream-300' : ''"
              >
                <td class="py-1.5 pr-4 font-bold">
                  <button v-if="i === 0" class="text-left hover:underline" @click="(exerciseId = row.history.exerciseId), (tab = 'exercises')">
                    {{ row.history.name }}
                  </button>
                </td>
                <td class="py-1.5 pr-4 text-sm text-ink-soft">{{ RECORD_LABELS[recordTypesFor(row.history.isBodyweight)[i]] }}</td>
                <td class="num py-1.5 pr-4 font-extrabold">{{ best ? recordText(best) : '—' }}</td>
                <td class="num py-1.5 text-sm text-ink-soft">
                  <RouterLink v-if="best" :to="`/history/${best.sessionId}`" class="hover:underline">{{ formatDate(best.date, 'short') }}</RouterLink>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </TabsContent>

      <!-- Bodyweight -->
      <TabsContent value="bodyweight">
        <div class="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div>
            <form class="pixel-box flex flex-col gap-4 p-5" novalidate @submit.prevent="saveBw.run()">
              <div class="flex items-center gap-3">
                <PixelSprite name="scale" :scale="2" />
                <h2 class="font-extrabold">Log bodyweight</h2>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="bw-date">Date</Label>
                <Input id="bw-date" v-model="bwDate" type="date" :max="todayKey()" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="bw-value">Weight ({{ unit }})</Label>
                <Input id="bw-value" v-model="bwValue" inputmode="decimal" class="num h-12 text-xl font-extrabold" :invalid="!!bwError" />
                <p v-if="bwError" class="text-sm text-berry-700">{{ bwError }}</p>
              </div>
              <Button type="submit" :disabled="saveBw.pending.value">Save</Button>
              <p class="text-xs text-ink-faint">One entry per day; saving again replaces it.</p>
            </form>

            <ul v-if="data.bodyweights.length" class="mt-6 max-h-[320px] overflow-y-auto">
              <li
                v-for="b in [...data.bodyweights].reverse()"
                :key="b.id"
                class="group flex items-center gap-3 rounded-[4px] px-2 py-1.5 hover:bg-cream-200"
              >
                <span class="num w-24 text-sm text-ink-soft">{{ formatDate(b.date, 'short') }}</span>
                <span class="num flex-1 font-bold">{{ fmtWeight(b.weightKg) }}</span>
                <button
                  class="rounded p-1 text-ink-faint opacity-0 hover:text-berry-700 focus-visible:opacity-100 group-hover:opacity-100"
                  :aria-label="`Delete entry for ${formatDate(b.date)}`"
                  @click="(bwDeleteTarget = b), (bwDeleteOpen = true)"
                >
                  <PixelGlyph name="trash" />
                </button>
              </li>
            </ul>
          </div>

          <section>
            <EmptyState v-if="!data.bodyweights.length" compact sprite="scale" title="No measurements yet" text="Log your bodyweight now and then. Weekly is plenty." />
            <p v-else-if="!bwSeries.length" class="rounded-[6px] border-2 border-dashed border-cream-400 p-8 text-center text-ink-soft">
              No entries in this time range.
            </p>
            <div v-else class="pixel-box p-5">
              <div class="mb-3 flex flex-wrap items-baseline justify-between gap-3">
                <h2 class="font-extrabold">Bodyweight <span class="font-normal text-ink-soft">({{ unit }})</span></h2>
                <p v-if="bwChange != null" class="num text-sm text-ink-soft">
                  Change in range:
                  <strong class="text-ink">{{ bwChange > 0 ? '+' : bwChange < 0 ? '−' : '' }}{{ fmtWeight(Math.abs(bwChange)) }}</strong>
                  over {{ plural(bwInRange.length, 'entry', 'entries') }}
                </p>
              </div>
              <TrendChart :series="bwSeries" :unit="unit" label="Bodyweight trend" />
            </div>
          </section>
        </div>
      </TabsContent>
    </Tabs>
  </QueryState>

  <ConfirmDialog
    v-model:open="bwDeleteOpen"
    title="Delete this measurement?"
    :description="bwDeleteTarget ? `${formatDate(bwDeleteTarget.date)}: ${fmtWeight(bwDeleteTarget.weightKg)}` : ''"
    confirm-label="Delete"
    tone="destructive"
    :pending="removeBw.pending.value"
    @confirm="removeBw.run()"
  />
</template>
