<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ExercisePicker from '@/components/ExercisePicker.vue'
import QueryState from '@/components/QueryState.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import NativeSelect from '@/components/ui/native-select/NativeSelect.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useAction } from '@/composables/useAction'
import { usePreferences } from '@/composables/usePreferences'
import { useToast } from '@/composables/useToast'
import { db } from '@/lib/db'
import { getRoutine, saveRoutine, validateRoutineDraft, type RoutineItemDraft } from '@/lib/repo/routines'
import { isBodyweightEquipment } from '@/lib/types'
import { parseWeightInput } from '@/lib/units'

const props = defineProps<{ id?: string }>()
const router = useRouter()
const toast = useToast()
const { unit, inputWeight, prefs } = usePreferences()

const REST_OPTIONS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300]
function restLabel(s: number) {
  if (s === 0) return 'No rest timer'
  return s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`
}

interface Row {
  key: string
  id?: string
  exerciseId: string
  name: string
  detail: string
  isBodyweight: boolean
  missing: boolean
  sets: string
  repMin: string
  repMax: string
  weight: string
  rest: string
}

const draft = reactive({ name: '', notes: '', rows: [] as Row[] })
const loading = ref(!!props.id)
const loadError = ref<unknown>(null)
const dirty = ref(false)
const errors = ref<string[]>([])
const pickerOpen = ref(false)
let keySeq = 0

onMounted(async () => {
  if (!props.id) return
  try {
    const routine = await getRoutine(props.id)
    if (!routine) throw new Error('This routine no longer exists.')
    draft.name = routine.name
    draft.notes = routine.notes
    draft.rows = routine.items.map((item) => ({
      key: `k${keySeq++}`,
      id: item.id,
      exerciseId: item.exerciseId,
      name: item.exercise?.name ?? 'Deleted exercise',
      detail: item.exercise ? `${item.exercise.muscleGroup} · ${item.exercise.equipment}` : '',
      isBodyweight: item.exercise ? isBodyweightEquipment(item.exercise.equipment) : false,
      missing: !item.exercise,
      sets: String(item.targetSets),
      repMin: String(item.repMin),
      repMax: String(item.repMax),
      weight: inputWeight(item.targetWeightKg),
      rest: String(item.restSeconds)
    }))
  } catch (error) {
    loadError.value = error
  } finally {
    loading.value = false
    // Ignore the reactive writes made while loading.
    setTimeout(() => (dirty.value = false))
  }
})

watch(draft, () => (dirty.value = true), { deep: true })

const nearestRest = computed(() => REST_OPTIONS.reduce((best, s) => (Math.abs(s - prefs.defaultRestSeconds) < Math.abs(best - prefs.defaultRestSeconds) ? s : best), 90))

async function addExercises(ids: string[]) {
  const exercises = await db.exercises.bulkGet(ids)
  for (const ex of exercises) {
    if (!ex) continue
    draft.rows.push({
      key: `k${keySeq++}`,
      exerciseId: ex.id,
      name: ex.name,
      detail: `${ex.muscleGroup} · ${ex.equipment}`,
      isBodyweight: isBodyweightEquipment(ex.equipment),
      missing: false,
      sets: '3',
      repMin: '8',
      repMax: '12',
      weight: '',
      rest: String(nearestRest.value)
    })
  }
  pickerOpen.value = false
}

function move(index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= draft.rows.length) return
  const [row] = draft.rows.splice(index, 1)
  draft.rows.splice(target, 0, row)
}

function intField(value: string) {
  return /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : NaN
}

function fieldInvalid(row: Row, field: 'sets' | 'repMin' | 'repMax' | 'weight') {
  if (!errors.value.length) return false
  if (field === 'weight') return !parseWeightInput(row.weight, unit.value).ok
  const n = intField(row[field])
  if (field === 'sets') return !(n >= 1 && n <= 20)
  if (field === 'repMin') return !(n >= 1 && n <= 100)
  return !(n >= intField(row.repMin) && n <= 100)
}

const save = useAction(async () => {
  const items: RoutineItemDraft[] = []
  const problems: string[] = []
  draft.rows.forEach((row, i) => {
    const weight = parseWeightInput(row.weight, unit.value)
    if (!weight.ok) problems.push(`Exercise ${i + 1}: ${weight.error.toLowerCase()}.`)
    if (row.missing) problems.push(`Exercise ${i + 1} was deleted from your library. Remove it to save.`)
    items.push({
      id: row.id,
      exerciseId: row.exerciseId,
      targetSets: intField(row.sets),
      repMin: intField(row.repMin),
      repMax: intField(row.repMax),
      targetWeightKg: weight.ok ? weight.value : null,
      restSeconds: Number(row.rest)
    })
  })
  const draftValue = { name: draft.name, notes: draft.notes, items }
  errors.value = [...problems, ...validateRoutineDraft(draftValue)]
  if (errors.value.length) return
  const id = await saveRoutine(props.id ?? null, draftValue)
  dirty.value = false
  toast.success(props.id ? 'Routine saved' : 'Routine created', 'Assign it to days in the Schedule tab.')
  if (!props.id) await router.replace(`/routines/${id}`)
}, { errorTitle: 'Could not save the routine' })

// Guard against losing unsaved edits.
const leaveOpen = ref(false)
let pendingPath: string | null = null
onBeforeRouteLeave((to) => {
  if (!dirty.value || save.pending.value) return true
  pendingPath = to.fullPath
  leaveOpen.value = true
  return false
})
function discardAndLeave() {
  dirty.value = false
  leaveOpen.value = false
  if (pendingPath) void router.push(pendingPath)
}

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void save.run()
  }
}
</script>

<template>
  <div @keydown="onKeydown">
    <RouterLink to="/routines" class="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-soft hover:text-ink">
      <PixelGlyph name="left" /> All routines
    </RouterLink>

    <QueryState :loading="loading" :error="loadError">
      <form novalidate @submit.prevent="save.run()">
        <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div class="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <Label for="routine-name" class="pixel-label">{{ id ? 'Edit routine' : 'New routine' }}</Label>
            <Input
              id="routine-name"
              v-model="draft.name"
              maxlength="80"
              placeholder="e.g. Push day, Full body A"
              class="h-12 text-xl font-bold"
              :invalid="errors.length > 0 && !draft.name.trim()"
            />
          </div>
          <div class="flex items-center gap-3">
            <span v-if="dirty" class="text-sm text-ink-soft">Unsaved changes</span>
            <Button type="submit" :disabled="save.pending.value"><PixelGlyph name="check" /> Save routine</Button>
          </div>
        </div>

        <div
          v-if="errors.length"
          role="alert"
          class="mb-6 rounded-[5px] border-2 border-berry-700 bg-berry-100 p-4 animate-shake"
        >
          <p class="font-bold">Almost there — fix these first:</p>
          <ul class="mt-1 list-disc pl-5 text-sm">
            <li v-for="e in errors" :key="e">{{ e }}</li>
          </ul>
        </div>

        <div class="mb-8 flex flex-col gap-1.5">
          <Label for="routine-notes">Notes <span class="font-normal text-ink-faint">(optional)</span></Label>
          <Textarea id="routine-notes" v-model="draft.notes" maxlength="1000" class="min-h-16" placeholder="Warm-up, focus for the day…" />
        </div>

        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="pixel-label">Exercises</h2>
          <span class="text-sm text-ink-soft">Weights in {{ unit }}. Leave target weight empty if you don't need one.</span>
        </div>

        <p v-if="!draft.rows.length" class="rounded-[6px] border-2 border-dashed border-cream-400 p-8 text-center text-ink-soft">
          No exercises yet. Add a few to build this routine.
        </p>

        <ol class="flex flex-col gap-4">
          <li
            v-for="(row, index) in draft.rows"
            :key="row.key"
            class="rounded-[6px] border-2 border-ink bg-paper p-4"
            :class="row.missing && 'border-berry-700 bg-berry-100'"
          >
            <div class="flex items-center gap-3">
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-[4px] border-2 border-ink bg-sun-300 num font-extrabold">
                {{ index + 1 }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-bold">{{ row.name }}</p>
                <p class="text-sm text-ink-soft">{{ row.detail || 'Removed from your library' }}</p>
              </div>
              <Button variant="ghost" size="icon-sm" :disabled="index === 0" :aria-label="`Move ${row.name} up`" @click="move(index, -1)">
                <PixelGlyph name="up" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :disabled="index === draft.rows.length - 1"
                :aria-label="`Move ${row.name} down`"
                @click="move(index, 1)"
              >
                <PixelGlyph name="down" />
              </Button>
              <Button variant="ghost" size="icon-sm" class="hover:text-berry-700" :aria-label="`Remove ${row.name}`" @click="draft.rows.splice(index, 1)">
                <PixelGlyph name="trash" />
              </Button>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-[90px_minmax(150px,1fr)_minmax(120px,1fr)_minmax(150px,1fr)]">
              <div class="flex flex-col gap-1">
                <Label :for="`sets-${row.key}`">Sets</Label>
                <Input :id="`sets-${row.key}`" v-model="row.sets" inputmode="numeric" class="num" :invalid="fieldInvalid(row, 'sets')" />
              </div>
              <div class="flex flex-col gap-1">
                <Label :for="`rmin-${row.key}`">Reps (range)</Label>
                <div class="flex items-center gap-2">
                  <Input :id="`rmin-${row.key}`" v-model="row.repMin" inputmode="numeric" aria-label="Minimum reps" class="num" :invalid="fieldInvalid(row, 'repMin')" />
                  <span class="text-ink-faint">–</span>
                  <Input v-model="row.repMax" inputmode="numeric" aria-label="Maximum reps" class="num" :invalid="fieldInvalid(row, 'repMax')" />
                </div>
              </div>
              <div class="flex flex-col gap-1">
                <Label :for="`w-${row.key}`">{{ row.isBodyweight ? 'Added weight' : 'Target weight' }} ({{ unit }})</Label>
                <Input
                  :id="`w-${row.key}`"
                  v-model="row.weight"
                  inputmode="decimal"
                  :placeholder="row.isBodyweight ? 'Bodyweight' : 'Optional'"
                  class="num"
                  :invalid="fieldInvalid(row, 'weight')"
                />
              </div>
              <div class="flex flex-col gap-1">
                <Label :for="`rest-${row.key}`">Rest between sets</Label>
                <NativeSelect :id="`rest-${row.key}`" v-model="row.rest">
                  <option v-if="!REST_OPTIONS.includes(Number(row.rest))" :value="row.rest">{{ restLabel(Number(row.rest)) }}</option>
                  <option v-for="s in REST_OPTIONS" :key="s" :value="String(s)">{{ restLabel(s) }}</option>
                </NativeSelect>
              </div>
            </div>
          </li>
        </ol>

        <div class="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" @click="pickerOpen = true"><PixelGlyph name="plus" /> Add exercises</Button>
          <span class="text-sm text-ink-faint">Tip: Ctrl+S saves.</span>
        </div>
      </form>
    </QueryState>

    <ExercisePicker v-model:open="pickerOpen" confirm-label="Add to routine" @pick="addExercises" />

    <ConfirmDialog
      v-model:open="leaveOpen"
      title="Leave without saving?"
      description="Your changes to this routine will be lost."
      confirm-label="Discard changes"
      cancel-label="Keep editing"
      tone="destructive"
      @confirm="discardAndLeave"
    />
  </div>
</template>
