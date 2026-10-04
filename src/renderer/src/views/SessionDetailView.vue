<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryState from '@/components/QueryState.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useAction } from '@/composables/useAction'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { usePreferences } from '@/composables/usePreferences'
import { useToast } from '@/composables/useToast'
import { formatDate, formatDuration, todayKey } from '@/lib/dates'
import { deleteSession, loadSessionDetail, saveSessionCorrection, type SessionCorrection } from '@/lib/repo/sessions'
import { estimateOneRepMax, summarizeSets } from '@/lib/stats'
import { parseRepsInput, parseWeightInput } from '@/lib/units'
import { plural } from '@/lib/utils'

const props = defineProps<{ id: string }>()
const router = useRouter()
const toast = useToast()
const { unit, fmtWeight, inputWeight } = usePreferences()

const { data: detail, loading, error } = useLiveQuery(() => loadSessionDetail(props.id), [() => props.id])
const summary = computed(() => (detail.value ? summarizeSets(detail.value.exercises.flatMap((e) => e.sets)) : null))

// ---- edit mode -----------------------------------------------------------------
interface DraftSet {
  key: string
  id?: string
  weight: string
  reps: string
}
interface DraftExercise {
  id: string
  name: string
  isBodyweight: boolean
  sets: DraftSet[]
}
const editing = ref(false)
const draft = reactive({ date: '', notes: '', exercises: [] as DraftExercise[] })
const errors = ref<string[]>([])
let seq = 0

function startEdit() {
  if (!detail.value) return
  draft.date = detail.value.session.date
  draft.notes = detail.value.session.notes
  draft.exercises = detail.value.exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    isBodyweight: ex.isBodyweight,
    sets: ex.sets.map((s) => ({ key: `s${seq++}`, id: s.id, weight: inputWeight(s.weightKg), reps: s.reps == null ? '' : String(s.reps) }))
  }))
  errors.value = []
  editing.value = true
}

function addDraftSet(ex: DraftExercise) {
  const last = ex.sets[ex.sets.length - 1]
  ex.sets.push({ key: `s${seq++}`, weight: last?.weight ?? '', reps: last?.reps ?? '' })
}

function setInvalid(ex: DraftExercise, set: DraftSet, field: 'weight' | 'reps') {
  if (!errors.value.length) return false
  if (field === 'reps') {
    const r = parseRepsInput(set.reps, { required: true })
    return !r.ok || (r.value ?? 0) < 1
  }
  return !parseWeightInput(set.weight, unit.value, { required: !ex.isBodyweight }).ok
}

const save = useAction(async () => {
  const problems: string[] = []
  const correction: SessionCorrection = {
    date: draft.date,
    notes: draft.notes,
    exercises: draft.exercises.map((ex) => ({
      id: ex.id,
      sets: ex.sets.map((s) => {
        const reps = parseRepsInput(s.reps, { required: true })
        const weight = parseWeightInput(s.weight, unit.value, { required: !ex.isBodyweight })
        if (!reps.ok || (reps.ok && (reps.value ?? 0) < 1)) problems.push(`${ex.name}: every set needs at least 1 rep.`)
        if (!weight.ok) problems.push(`${ex.name}: ${weight.error.toLowerCase()}.`)
        return { id: s.id, reps: reps.ok ? reps.value ?? 0 : 0, weightKg: weight.ok ? weight.value : null }
      })
    }))
  }
  if (!draft.date) problems.push('Pick a date.')
  if (draft.date > todayKey()) problems.push('The date cannot be in the future.')
  if (!correction.exercises.some((e) => e.sets.length)) problems.push('Keep at least one set, or delete the workout instead.')
  errors.value = [...new Set(problems)]
  if (errors.value.length) return
  await saveSessionCorrection(props.id, correction)
  editing.value = false
  toast.success('Workout updated', 'Progress and records were recalculated.')
}, { errorTitle: 'Could not save your corrections' })

// ---- delete -----------------------------------------------------------------
const deleteOpen = ref(false)
const remove = useAction(async () => {
  await deleteSession(props.id)
  deleteOpen.value = false
  editing.value = false
  toast.success('Workout deleted')
  await router.push('/history')
})

const leaveOpen = ref(false)
let pendingPath: string | null = null
onBeforeRouteLeave((to) => {
  if (!editing.value || save.pending.value) return true
  pendingPath = to.fullPath
  leaveOpen.value = true
  return false
})
function leave() {
  editing.value = false
  leaveOpen.value = false
  if (pendingPath) void router.push(pendingPath)
}

function setLabel(weightKg: number | null, isBodyweight: boolean) {
  if (isBodyweight) return weightKg ? `BW + ${fmtWeight(weightKg)}` : 'Bodyweight'
  return fmtWeight(weightKg)
}
</script>

<template>
  <RouterLink to="/history" class="mb-4 inline-flex items-center gap-2 text-sm font-bold text-ink-soft hover:text-ink">
    <PixelGlyph name="left" /> History
  </RouterLink>

  <QueryState :loading="loading" :error="error">
    <EmptyState v-if="!detail" sprite="book" title="Workout not found" text="It may have been deleted.">
      <Button as-child variant="secondary"><RouterLink to="/history">Back to history</RouterLink></Button>
    </EmptyState>

    <EmptyState v-else-if="detail.session.status === 'active'" sprite="stopwatch" title="This workout is still in progress">
      <Button as-child><RouterLink to="/workout">Resume it</RouterLink></Button>
    </EmptyState>

    <template v-else>
      <PageHeader
        :eyebrow="formatDate(detail.session.date, 'long')"
        :title="detail.session.routineName"
        :subtitle="
          [
            summary && plural(summary.setCount, 'set'),
            summary && summary.volumeKg ? `${fmtWeight(summary.volumeKg)} volume` : '',
            detail.session.finishedAt ? formatDuration(detail.session.finishedAt - detail.session.startedAt) : ''
          ]
            .filter(Boolean)
            .join(' · ')
        "
      >
        <template #actions>
          <template v-if="!editing">
            <Button variant="ghost" class="text-berry-700" @click="deleteOpen = true"><PixelGlyph name="trash" /> Delete</Button>
            <Button variant="secondary" @click="startEdit"><PixelGlyph name="pencil" /> Correct details</Button>
          </template>
          <template v-else>
            <Button variant="secondary" @click="editing = false">Cancel</Button>
            <Button :disabled="save.pending.value" @click="save.run()"><PixelGlyph name="check" /> Save changes</Button>
          </template>
        </template>
      </PageHeader>

      <!-- Read-only view -->
      <template v-if="!editing">
        <div class="flex flex-col gap-8">
          <section v-for="ex in detail.exercises" :key="ex.id">
            <h2 class="text-lg font-extrabold">{{ ex.name }}</h2>
            <p class="mb-2 text-sm text-ink-soft">{{ ex.muscleGroup }} · {{ ex.equipment }}</p>
            <table class="w-full max-w-xl text-left">
              <thead>
                <tr class="pixel-label">
                  <th class="w-14 py-1 font-normal">Set</th>
                  <th class="py-1 font-normal">Weight</th>
                  <th class="py-1 font-normal">Reps</th>
                  <th v-if="!ex.isBodyweight" class="py-1 font-normal">Est. 1RM</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, i) in ex.sets" :key="s.id" class="border-t-2 border-dashed border-cream-300">
                  <td class="num py-1.5 text-ink-soft">{{ i + 1 }}</td>
                  <td class="num py-1.5 font-bold">{{ setLabel(s.weightKg, ex.isBodyweight) }}</td>
                  <td class="num py-1.5 font-bold">{{ s.reps }}</td>
                  <td v-if="!ex.isBodyweight" class="num py-1.5 text-ink-soft">
                    {{ s.weightKg && s.reps ? fmtWeight(estimateOneRepMax(s.weightKg, s.reps)) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
        <section v-if="detail.session.notes" class="mt-10 max-w-xl">
          <h2 class="pixel-label mb-2">Notes</h2>
          <p class="whitespace-pre-wrap">{{ detail.session.notes }}</p>
        </section>
        <p class="mt-10 text-sm text-ink-faint">
          Est. 1RM uses the Epley formula and is only shown for sets of 12 reps or fewer.
        </p>
      </template>

      <!-- Correction mode -->
      <form v-else novalidate @submit.prevent="save.run()">
        <div v-if="errors.length" role="alert" class="mb-6 animate-shake rounded-[5px] border-2 border-berry-700 bg-berry-100 p-4">
          <p class="font-bold">Please fix:</p>
          <ul class="mt-1 list-disc pl-5 text-sm">
            <li v-for="e in errors" :key="e">{{ e }}</li>
          </ul>
        </div>

        <div class="mb-8 flex flex-wrap gap-6">
          <div class="flex flex-col gap-1.5">
            <Label for="session-date">Date</Label>
            <Input id="session-date" v-model="draft.date" type="date" :max="todayKey()" class="w-48" />
          </div>
        </div>

        <div class="flex flex-col gap-8">
          <section v-for="(ex, exIndex) in draft.exercises" :key="ex.id" class="rounded-[6px] border-2 border-ink bg-paper p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <h2 class="text-lg font-extrabold">{{ ex.name }}</h2>
              <Button size="sm" variant="ghost" class="text-berry-700" @click="draft.exercises.splice(exIndex, 1)">
                <PixelGlyph name="trash" /> Remove exercise
              </Button>
            </div>
            <div class="grid grid-cols-[44px_minmax(90px,160px)_minmax(80px,140px)_36px] items-center gap-2">
              <span class="pixel-label">Set</span>
              <span class="pixel-label">{{ ex.isBodyweight ? `Added ${unit}` : unit }}</span>
              <span class="pixel-label">Reps</span>
              <span />
              <template v-for="(s, i) in ex.sets" :key="s.key">
                <span class="num text-ink-soft">{{ i + 1 }}</span>
                <Input
                  v-model="s.weight"
                  inputmode="decimal"
                  :placeholder="ex.isBodyweight ? 'BW' : ''"
                  :aria-label="`Set ${i + 1} weight`"
                  class="num font-bold"
                  :invalid="setInvalid(ex, s, 'weight')"
                />
                <Input v-model="s.reps" inputmode="numeric" :aria-label="`Set ${i + 1} reps`" class="num font-bold" :invalid="setInvalid(ex, s, 'reps')" />
                <Button size="icon-sm" variant="ghost" :aria-label="`Remove set ${i + 1}`" @click="ex.sets.splice(i, 1)">
                  <PixelGlyph name="close" :size="8" />
                </Button>
              </template>
            </div>
            <Button size="sm" variant="secondary" class="mt-3" @click="addDraftSet(ex)"><PixelGlyph name="plus" /> Add set</Button>
          </section>
        </div>

        <div class="mt-8 flex max-w-xl flex-col gap-1.5">
          <Label for="session-notes-edit">Notes</Label>
          <Textarea id="session-notes-edit" v-model="draft.notes" maxlength="4000" />
        </div>
        <p class="mt-4 text-sm text-ink-faint">Weights shown in {{ unit }}. Stored precisely, so switching units later is lossless.</p>
      </form>
    </template>
  </QueryState>

  <ConfirmDialog
    v-model:open="deleteOpen"
    title="Delete this workout?"
    description="It will be removed from history, progress charts and records. This can't be undone."
    confirm-label="Delete workout"
    tone="destructive"
    :pending="remove.pending.value"
    @confirm="remove.run()"
  />
  <ConfirmDialog
    v-model:open="leaveOpen"
    title="Leave without saving?"
    description="Your corrections will be lost."
    confirm-label="Discard changes"
    cancel-label="Keep editing"
    tone="destructive"
    @confirm="leave"
  />
</template>
