<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import ExercisePicker from '@/components/ExercisePicker.vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryState from '@/components/QueryState.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import PixelSprite from '@/components/pixel/PixelSprite.vue'
import { Button } from '@/components/ui/button'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import RestTimer from '@/components/workout/RestTimer.vue'
import SetRow, { type SetSuggestion } from '@/components/workout/SetRow.vue'
import WorkoutComplete from '@/components/workout/WorkoutComplete.vue'
import { useAction } from '@/composables/useAction'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { usePreferences } from '@/composables/usePreferences'
import { useRestTimer } from '@/composables/useRestTimer'
import { useToast } from '@/composables/useToast'
import { formatClock, formatDate, formatDuration, todayKey } from '@/lib/dates'
import { listRoutines } from '@/lib/repo/routines'
import { loadSchedule, resolveDayPlan } from '@/lib/repo/schedule'
import {
  addExerciseToSession,
  addSet,
  deleteSession,
  finishSession,
  getActiveSession,
  getPreviousPerformance,
  loadSessionDetail,
  removeSessionExercise,
  removeSet,
  startSession,
  updateSessionNotes,
  updateSet,
  type PreviousPerformance,
  type SessionExerciseWithSets
} from '@/lib/repo/sessions'
import type { LoggedSet } from '@/lib/types'
import { plural } from '@/lib/utils'

const router = useRouter()
const toast = useToast()
const timer = useRestTimer()
const { prefs, unit, showWeight } = usePreferences()

const { data, loading, error } = useLiveQuery(async () => {
  const active = await getActiveSession()
  if (!active) return { detail: null, previous: {} as Record<string, PreviousPerformance | null> }
  const detail = (await loadSessionDetail(active.id)) ?? null
  const ids = [...new Set(detail?.exercises.map((e) => e.exerciseId) ?? [])]
  const entries = await Promise.all(ids.map(async (id) => [id, await getPreviousPerformance(id, active.id)] as const))
  return { detail, previous: Object.fromEntries(entries) as Record<string, PreviousPerformance | null> }
})

const detail = computed(() => data.value?.detail ?? null)
const session = computed(() => detail.value?.session ?? null)

// ---- chooser (no active workout) -----------------------------------------
const { data: chooser } = useLiveQuery(async () => {
  const [routines, schedule] = await Promise.all([listRoutines(), loadSchedule()])
  return { routines, plan: resolveDayPlan(todayKey(), schedule) }
})

const start = useAction(async (routineId: string | null) => {
  await startSession({ routineId })
})

// ---- elapsed clock ----------------------------------------------------------
const now = ref(Date.now())
const tick = window.setInterval(() => (now.value = Date.now()), 1000)
onBeforeUnmount(() => window.clearInterval(tick))
const elapsed = computed(() => (session.value ? Math.max(0, (now.value - session.value.startedAt) / 1000) : 0))

// ---- helpers ----------------------------------------------------------------
function formatSetValue(reps: number, weightKg: number | null, isBodyweight: boolean) {
  if (isBodyweight) return weightKg ? `+${showWeight(weightKg)} × ${reps}` : `BW × ${reps}`
  return `${showWeight(weightKg)} × ${reps}`
}

function previousFor(ex: SessionExerciseWithSets, index: number): string {
  const prev = data.value?.previous[ex.exerciseId]
  const set = prev?.sets[index]
  return set ? formatSetValue(set.reps, set.weightKg, ex.isBodyweight) : '—'
}

function suggestionFor(ex: SessionExerciseWithSets, index: number): SetSuggestion {
  const prev = data.value?.previous[ex.exerciseId]
  const prevSet = prev?.sets[index] ?? prev?.sets[prev.sets.length - 1]
  const range = ex.repMin != null && ex.repMax != null ? (ex.repMin === ex.repMax ? null : `${ex.repMin}–${ex.repMax}`) : undefined
  // What you actually lifted last time beats the routine's static target.
  if (prevSet) return { reps: prevSet.reps, weightKg: prevSet.weightKg ?? ex.targetWeightKg, repsHint: range ?? undefined }
  return {
    reps: ex.repMin != null && ex.repMin === ex.repMax ? ex.repMin : null,
    weightKg: ex.targetWeightKg,
    repsHint: range ?? undefined
  }
}

function targetText(ex: SessionExerciseWithSets) {
  const parts: string[] = []
  if (ex.targetSets != null && ex.repMin != null && ex.repMax != null) {
    parts.push(`${ex.targetSets} × ${ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`}`)
  }
  if (ex.targetWeightKg != null) parts.push(`@ ${showWeight(ex.targetWeightKg)} ${unit.value}`)
  if (ex.restSeconds) parts.push(`rest ${formatClock(ex.restSeconds)}`)
  return parts.join(' · ')
}

const totals = computed(() => {
  const sets = detail.value?.exercises.flatMap((e) => e.sets) ?? []
  const done = sets.filter((s) => s.completed)
  return { done: done.length, total: sets.length, pending: sets.length - done.length }
})

// ---- set actions --------------------------------------------------------------
const rows = ref<Record<string, InstanceType<typeof SetRow> | null>>({})

async function onSave(set: LoggedSet, patch: { reps?: number | null; weightKg?: number | null }) {
  try {
    await updateSet(set.id, patch)
  } catch (e) {
    toast.error('Could not save that set', (e as Error).message)
  }
}

async function onComplete(ex: SessionExerciseWithSets, set: LoggedSet, values: { reps: number; weightKg: number | null }) {
  try {
    await updateSet(set.id, { ...values, completed: true })
  } catch (e) {
    toast.error('Could not save that set', (e as Error).message)
    return
  }
  if (ex.restSeconds > 0) timer.start(ex.restSeconds, ex.name)
  // Jump to the next unfinished set so logging stays keyboard-only.
  const ordered = detail.value?.exercises.flatMap((e) => e.sets) ?? []
  const next = ordered.slice(ordered.findIndex((s) => s.id === set.id) + 1).find((s) => !s.completed)
  await nextTick()
  if (next) rows.value[next.id]?.focus()
}

async function onUncomplete(set: LoggedSet) {
  await updateSet(set.id, { completed: false })
}

const addSetAction = useAction(async (ex: SessionExerciseWithSets) => {
  const id = await addSet(ex.id)
  await nextTick()
  setTimeout(() => rows.value[id]?.focus(), 50)
})

async function onRemoveSet(set: LoggedSet) {
  await removeSet(set.id)
}

const removeExerciseTarget = ref<SessionExerciseWithSets | null>(null)
const removeExerciseOpen = ref(false)
function askRemoveExercise(ex: SessionExerciseWithSets) {
  if (!ex.sets.some((s) => s.completed)) {
    void removeSessionExercise(ex.id)
    return
  }
  removeExerciseTarget.value = ex
  removeExerciseOpen.value = true
}
const removeExercise = useAction(async () => {
  if (removeExerciseTarget.value) await removeSessionExercise(removeExerciseTarget.value.id)
  removeExerciseOpen.value = false
})

const pickerOpen = ref(false)
const addExercises = useAction(async (ids: string[]) => {
  if (!session.value) return
  for (const id of ids) await addExerciseToSession(session.value.id, id, prefs.defaultRestSeconds)
  pickerOpen.value = false
})

// ---- notes (debounced autosave) ---------------------------------------------
const notes = ref('')
let notesTimer: number | null = null
watch(
  () => session.value?.id,
  () => {
    notes.value = session.value?.notes ?? ''
  },
  { immediate: true }
)
function onNotesInput() {
  if (notesTimer != null) window.clearTimeout(notesTimer)
  notesTimer = window.setTimeout(saveNotes, 500)
}
function saveNotes() {
  if (notesTimer != null) window.clearTimeout(notesTimer)
  notesTimer = null
  if (session.value && notes.value !== session.value.notes) void updateSessionNotes(session.value.id, notes.value)
}
onBeforeUnmount(saveNotes)

// ---- finish / discard -----------------------------------------------------------
const finishOpen = ref(false)
const discardOpen = ref(false)
const completed = ref<{ sessionId: string } | null>(null)

const finish = useAction(async () => {
  if (!session.value) return
  saveNotes()
  const id = session.value.id
  await finishSession(id)
  timer.reset()
  finishOpen.value = false
  completed.value = { sessionId: id }
}, { errorTitle: 'Could not finish the workout' })

const discard = useAction(async () => {
  if (!session.value) return
  await deleteSession(session.value.id)
  timer.reset()
  discardOpen.value = false
  toast.info('Workout discarded')
  await router.push('/')
})

function onPageKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && session.value) {
    event.preventDefault()
    finishOpen.value = true
  }
}
</script>

<template>
  <div @keydown="onPageKeydown">
    <QueryState :loading="loading" :error="error">
      <!-- Choose what to train -->
      <template v-if="!session && !completed">
        <PageHeader eyebrow="Workout" title="What are we training?" subtitle="Pick a routine or start empty and add exercises as you go." />

        <div v-if="chooser" class="flex flex-col gap-8">
          <div
            v-if="chooser.plan.kind === 'routine'"
            class="pixel-box flex flex-wrap items-center gap-5 bg-leaf-100 p-6"
          >
            <PixelSprite name="calendar" :scale="3" />
            <div class="min-w-0 flex-1">
              <p class="pixel-label">Planned for today</p>
              <p class="pixel-title text-xl">{{ chooser.plan.routineName }}</p>
            </div>
            <Button size="lg" :disabled="start.pending.value" @click="start.run(chooser.plan.kind === 'routine' ? chooser.plan.routineId : null)">
              <PixelGlyph name="play" /> Start
            </Button>
          </div>

          <section v-if="chooser.routines.length">
            <h2 class="pixel-label mb-3">Your routines</h2>
            <ul class="grid gap-3 md:grid-cols-2">
              <li v-for="r in chooser.routines" :key="r.id">
                <button
                  class="flex w-full items-center gap-4 rounded-[6px] border-2 border-ink bg-paper p-4 text-left shadow-pixel transition-transform hover:bg-cream-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-pixel-sm disabled:opacity-50"
                  :disabled="!r.items.length || start.pending.value"
                  @click="start.run(r.id)"
                >
                  <PixelSprite name="clipboard" :scale="2" />
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-bold">{{ r.name }}</span>
                    <span class="block text-sm text-ink-soft">{{ r.items.length ? plural(r.items.length, 'exercise') : 'No exercises yet' }}</span>
                  </span>
                  <PixelGlyph name="play" class="text-leaf-700" />
                </button>
              </li>
            </ul>
          </section>

          <div class="flex flex-wrap items-center gap-4">
            <Button variant="secondary" :disabled="start.pending.value" @click="start.run(null)"><PixelGlyph name="plus" /> Start a free workout</Button>
            <RouterLink v-if="!chooser.routines.length" to="/routines/new" class="font-bold text-sky-700 hover:underline">or build a routine first</RouterLink>
          </div>
        </div>
      </template>

      <!-- Active workout -->
      <template v-else-if="session && detail">
        <PageHeader :eyebrow="`${formatDate(session.date)} · ${formatDuration(elapsed * 1000)}`" :title="session.routineName">
          <template #actions>
            <Button variant="ghost" class="text-berry-700" @click="discardOpen = true"><PixelGlyph name="trash" /> Discard</Button>
            <Button :disabled="finish.pending.value" @click="finishOpen = true"><PixelGlyph name="flag" /> Finish</Button>
          </template>
        </PageHeader>

        <div class="sticky top-0 z-20 -mx-2 mb-8 bg-cream-100 px-2 pb-2 pt-1">
          <RestTimer />
        </div>

        <EmptyState
          v-if="!detail.exercises.length"
          compact
          sprite="dumbbell"
          title="Empty workout"
          text="Add the exercises you're doing. Logged sets save instantly, so closing the app won't lose anything."
        >
          <Button @click="pickerOpen = true"><PixelGlyph name="plus" /> Add exercise</Button>
        </EmptyState>

        <div class="flex flex-col gap-10">
          <section v-for="ex in detail.exercises" :key="ex.id" :aria-label="ex.name">
            <div class="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div class="min-w-0">
                <h2 class="truncate text-xl font-extrabold">{{ ex.name }}</h2>
                <p class="text-sm text-ink-soft">
                  {{ ex.muscleGroup }} · {{ ex.equipment }}
                  <template v-if="targetText(ex)"> · <span class="num">{{ targetText(ex) }}</span></template>
                </p>
              </div>
              <div class="flex items-center gap-1">
                <span v-if="data?.previous[ex.exerciseId]" class="mr-2 text-sm text-ink-faint">
                  Last: {{ formatDate(data.previous[ex.exerciseId]!.date, 'short') }}
                </span>
                <Button
                  v-if="ex.restSeconds"
                  size="sm"
                  variant="ghost"
                  :aria-label="`Start ${formatClock(ex.restSeconds)} rest`"
                  @click="timer.start(ex.restSeconds, ex.name)"
                >
                  <PixelGlyph name="clock" /> {{ formatClock(ex.restSeconds) }}
                </Button>
                <Button size="icon-sm" variant="ghost" class="hover:text-berry-700" :aria-label="`Remove ${ex.name} from workout`" @click="askRemoveExercise(ex)">
                  <PixelGlyph name="trash" />
                </Button>
              </div>
            </div>

            <div class="rounded-[6px] border-2 border-ink bg-paper p-2">
              <div
                class="grid grid-cols-[44px_minmax(70px,1fr)_minmax(84px,1.1fr)_minmax(72px,1fr)_48px_32px] gap-2 px-2 pb-1 pt-1"
                aria-hidden="true"
              >
                <span class="pixel-label">Set</span>
                <span class="pixel-label">Previous</span>
                <span class="pixel-label text-center">{{ ex.isBodyweight ? `+${unit}` : unit }}</span>
                <span class="pixel-label text-center">Reps</span>
                <span class="pixel-label text-center">Done</span>
                <span />
              </div>
              <SetRow
                v-for="(set, i) in ex.sets"
                :key="set.id"
                :ref="(el) => (rows[set.id] = el as InstanceType<typeof SetRow> | null)"
                :set="set"
                :index="i"
                :exercise-name="ex.name"
                :is-bodyweight="ex.isBodyweight"
                :previous="previousFor(ex, i)"
                :suggestion="suggestionFor(ex, i)"
                @save="(patch) => onSave(set, patch)"
                @complete="(values) => onComplete(ex, set, values)"
                @uncomplete="onUncomplete(set)"
                @remove="onRemoveSet(set)"
              />
              <p v-if="!ex.sets.length" class="px-3 py-2 text-sm text-ink-soft">No sets. Add one below.</p>
              <div class="px-2 pb-1 pt-2">
                <Button size="sm" variant="secondary" :disabled="addSetAction.pending.value" @click="addSetAction.run(ex)">
                  <PixelGlyph name="plus" /> Add set
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div v-if="detail.exercises.length" class="mt-8">
          <Button variant="secondary" @click="pickerOpen = true"><PixelGlyph name="plus" /> Add exercise</Button>
        </div>

        <section class="mt-12">
          <label for="session-notes" class="pixel-label mb-2 block">Session notes</label>
          <Textarea
            id="session-notes"
            v-model="notes"
            maxlength="4000"
            placeholder="How did it feel? Sleep, energy, anything to remember next time…"
            @input="onNotesInput"
            @blur="saveNotes"
          />
        </section>

        <div class="mt-10 flex flex-wrap items-center justify-between gap-4 border-t-2 border-dashed border-cream-400 pt-6">
          <p class="text-ink-soft">
            <strong class="num text-ink">{{ totals.done }}</strong> of {{ plural(totals.total, 'set') }} done.
            <span class="text-ink-faint">Empty fields use the grey suggestion · Enter moves on · Ctrl+Enter finishes.</span>
          </p>
          <Button size="lg" :disabled="finish.pending.value" @click="finishOpen = true"><PixelGlyph name="flag" /> Finish workout</Button>
        </div>
      </template>
    </QueryState>

    <WorkoutComplete v-if="completed" :session-id="completed.sessionId" @close="completed = null" />

    <ExercisePicker v-model:open="pickerOpen" confirm-label="Add to workout" :pending="addExercises.pending.value" @pick="addExercises.run" />

    <ConfirmDialog
      v-model:open="finishOpen"
      :title="totals.done ? 'Finish this workout?' : 'Nothing logged yet'"
      :confirm-label="totals.done ? 'Finish workout' : 'OK'"
      :pending="finish.pending.value"
      @confirm="totals.done ? finish.run() : (finishOpen = false)"
    >
      <div class="mt-3 flex flex-col gap-2 text-ink-soft">
        <p v-if="totals.done">
          You completed <strong class="text-ink">{{ plural(totals.done, 'set') }}</strong>.
          <template v-if="totals.pending">
            The <strong class="text-ink">{{ plural(totals.pending, 'unfinished set') }}</strong> will be left out.
          </template>
        </p>
        <p v-else>Complete at least one set before finishing — or discard the workout if you changed your mind.</p>
      </div>
    </ConfirmDialog>

    <ConfirmDialog
      v-model:open="discardOpen"
      title="Discard this workout?"
      :description="`This deletes the workout and its ${plural(totals.done, 'completed set')}. It can't be undone.`"
      confirm-label="Discard workout"
      cancel-label="Keep logging"
      tone="destructive"
      :pending="discard.pending.value"
      @confirm="discard.run()"
    />

    <ConfirmDialog
      v-model:open="removeExerciseOpen"
      :title="`Remove ${removeExerciseTarget?.name ?? 'exercise'}?`"
      description="Its completed sets in this workout will be deleted."
      confirm-label="Remove"
      tone="destructive"
      :pending="removeExercise.pending.value"
      @confirm="removeExercise.run()"
    />
  </div>
</template>
