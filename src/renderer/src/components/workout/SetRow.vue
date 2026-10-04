<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import { usePreferences } from '@/composables/usePreferences'
import type { LoggedSet } from '@/lib/types'
import { parseRepsInput, parseWeightInput } from '@/lib/units'

export interface SetSuggestion {
  reps: number | null
  weightKg: number | null
  /** Text shown in the reps field when there is no single number to suggest. */
  repsHint?: string
}

const props = defineProps<{
  set: LoggedSet
  index: number
  exerciseName: string
  isBodyweight: boolean
  previous: string
  suggestion: SetSuggestion
}>()

const emit = defineEmits<{
  save: [patch: { reps?: number | null; weightKg?: number | null }]
  complete: [values: { reps: number; weightKg: number | null }]
  uncomplete: []
  remove: []
}>()

const { unit, inputWeight, showWeight } = usePreferences()

const root = ref<HTMLElement | null>(null)
const weightText = ref(inputWeight(props.set.weightKg))
const repsText = ref(props.set.reps == null ? '' : String(props.set.reps))
const error = ref('')

// Pull in database values unless the user is typing in this row.
function syncFromProps() {
  if (root.value?.contains(document.activeElement)) return
  weightText.value = inputWeight(props.set.weightKg)
  repsText.value = props.set.reps == null ? '' : String(props.set.reps)
}
watch(() => [props.set.weightKg, props.set.reps, unit.value], syncFromProps)

const weightParse = computed(() => parseWeightInput(weightText.value, unit.value))
const repsParse = computed(() => parseRepsInput(repsText.value))

let timer: number | null = null
function scheduleSave() {
  error.value = ''
  if (timer != null) window.clearTimeout(timer)
  timer = window.setTimeout(flush, 400)
}
function flush() {
  if (timer != null) window.clearTimeout(timer)
  timer = null
  const patch: { reps?: number | null; weightKg?: number | null } = {}
  if (weightParse.value.ok && weightParse.value.value !== props.set.weightKg) patch.weightKg = weightParse.value.value
  if (repsParse.value.ok && repsParse.value.value !== props.set.reps) patch.reps = repsParse.value.value
  if (Object.keys(patch).length) emit('save', patch)
}
onBeforeUnmount(flush)

const weightPlaceholder = computed(() => {
  if (props.suggestion.weightKg != null) return showWeight(props.suggestion.weightKg)
  return props.isBodyweight ? 'BW' : unit.value
})
const repsPlaceholder = computed(() =>
  props.suggestion.reps != null ? String(props.suggestion.reps) : props.suggestion.repsHint ?? 'reps'
)

function toggleComplete() {
  if (props.set.completed) {
    emit('uncomplete')
    return
  }
  if (!weightParse.value.ok) return void (error.value = weightParse.value.error)
  if (!repsParse.value.ok) return void (error.value = repsParse.value.error)
  // Empty fields adopt the grey suggestion.
  const reps = repsParse.value.value ?? props.suggestion.reps
  const weightKg = weightParse.value.value ?? props.suggestion.weightKg
  if (reps == null || reps < 1) return void (error.value = 'Enter at least 1 rep')
  if (weightKg == null && !props.isBodyweight) return void (error.value = 'Enter a weight')
  if (timer != null) window.clearTimeout(timer)
  timer = null
  error.value = ''
  weightText.value = inputWeight(weightKg)
  repsText.value = String(reps)
  emit('complete', { reps, weightKg })
}

function focusReps(event: KeyboardEvent) {
  event.preventDefault()
  root.value?.querySelector<HTMLInputElement>('[data-field="reps"]')?.focus()
}

defineExpose({
  focus: () => root.value?.querySelector<HTMLInputElement>('input')?.focus()
})
</script>

<template>
  <div
    ref="root"
    :data-set="set.id"
    class="grid grid-cols-[44px_minmax(70px,1fr)_minmax(84px,1.1fr)_minmax(72px,1fr)_48px_32px] items-center gap-2 rounded-[5px] px-2 py-1.5 transition-colors"
    :class="set.completed ? 'bg-leaf-100' : ''"
    @focusout="flush"
  >
    <span
      class="num grid h-9 w-9 place-items-center rounded-[4px] border-2 text-sm font-extrabold"
      :class="set.completed ? 'border-ink bg-leaf-500' : 'border-cream-400 text-ink-soft'"
    >
      {{ index + 1 }}
    </span>
    <span class="num truncate text-sm text-ink-soft" :title="previous">{{ previous }}</span>
    <input
      v-model="weightText"
      data-field="weight"
      inputmode="decimal"
      :aria-label="`${exerciseName} set ${index + 1} ${isBodyweight ? 'added weight' : 'weight'} (${unit})`"
      :placeholder="weightPlaceholder"
      :aria-invalid="!weightParse.ok || undefined"
      class="num h-12 w-full min-w-0 rounded-[5px] border-2 border-ink bg-paper px-2 text-center text-xl font-extrabold placeholder:font-semibold placeholder:text-ink-faint/70 focus-visible:outline-3 focus-visible:outline-sky-700 aria-[invalid=true]:bg-berry-100"
      @input="scheduleSave"
      @keydown.enter="focusReps"
    />
    <input
      v-model="repsText"
      data-field="reps"
      inputmode="numeric"
      :aria-label="`${exerciseName} set ${index + 1} reps`"
      :placeholder="repsPlaceholder"
      :aria-invalid="!repsParse.ok || undefined"
      class="num h-12 w-full min-w-0 rounded-[5px] border-2 border-ink bg-paper px-2 text-center text-xl font-extrabold placeholder:font-semibold placeholder:text-ink-faint/70 focus-visible:outline-3 focus-visible:outline-sky-700 aria-[invalid=true]:bg-berry-100"
      @input="scheduleSave"
      @keydown.enter.prevent="toggleComplete"
    />
    <button
      type="button"
      class="grid h-11 w-11 place-items-center rounded-[5px] border-2 border-ink shadow-pixel-sm transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      :class="set.completed ? 'bg-leaf-500' : 'bg-paper hover:bg-leaf-100'"
      :aria-label="set.completed ? `Mark ${exerciseName} set ${index + 1} not done` : `Complete ${exerciseName} set ${index + 1}`"
      :aria-pressed="set.completed"
      @click="toggleComplete"
    >
      <PixelGlyph name="check" :class="set.completed ? 'animate-pop' : 'opacity-30'" />
    </button>
    <button
      type="button"
      class="grid h-8 w-8 place-items-center rounded-[4px] text-ink-faint hover:bg-berry-100 hover:text-berry-700"
      :aria-label="`Remove ${exerciseName} set ${index + 1}`"
      @click="emit('remove')"
    >
      <PixelGlyph name="close" :size="8" />
    </button>
    <p v-if="error" role="alert" class="col-span-full -mt-0.5 pl-[52px] text-sm font-semibold text-berry-700">{{ error }}</p>
  </div>
</template>
