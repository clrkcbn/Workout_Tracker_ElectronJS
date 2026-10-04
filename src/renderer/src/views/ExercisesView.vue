<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryState from '@/components/QueryState.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import NativeSelect from '@/components/ui/native-select/NativeSelect.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import { useAction } from '@/composables/useAction'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useToast } from '@/composables/useToast'
import {
  addStarterLibrary,
  createExercise,
  deleteExercise,
  exerciseUsage,
  listExercises,
  STARTER_EXERCISES,
  updateExercise,
  validateExerciseInput,
  type ExerciseInput
} from '@/lib/repo/exercises'
import { EQUIPMENT, MUSCLE_GROUPS, type Exercise } from '@/lib/types'
import { plural } from '@/lib/utils'

const toast = useToast()
const { data: exercises, loading, error } = useLiveQuery(listExercises)

const search = ref('')
const muscleFilter = ref('')
const equipmentFilter = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (exercises.value ?? []).filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q)) &&
      (!muscleFilter.value || e.muscleGroup === muscleFilter.value) &&
      (!equipmentFilter.value || e.equipment === equipmentFilter.value)
  )
})
const grouped = computed(() =>
  MUSCLE_GROUPS.map((group) => ({ group, items: filtered.value.filter((e) => e.muscleGroup === group) })).filter((g) => g.items.length)
)
const hasFilters = computed(() => !!(search.value || muscleFilter.value || equipmentFilter.value))
const missingStarters = computed(() => {
  const names = new Set((exercises.value ?? []).map((e) => e.name.toLowerCase()))
  return STARTER_EXERCISES.filter((s) => !names.has(s.name.toLowerCase())).length
})

function clearFilters() {
  search.value = ''
  muscleFilter.value = ''
  equipmentFilter.value = ''
}

// ---- create / edit ---------------------------------------------------------
const formOpen = ref(false)
const editing = ref<Exercise | null>(null)
const form = reactive<ExerciseInput>({ name: '', muscleGroup: 'Chest', equipment: 'Barbell', notes: '' })
const formErrors = ref<Record<string, string>>({})

function openForm(exercise?: Exercise) {
  editing.value = exercise ?? null
  Object.assign(form, exercise ? { name: exercise.name, muscleGroup: exercise.muscleGroup, equipment: exercise.equipment, notes: exercise.notes } : { name: '', muscleGroup: muscleFilter.value || 'Chest', equipment: 'Barbell', notes: '' })
  formErrors.value = {}
  formOpen.value = true
}

const save = useAction(async () => {
  formErrors.value = validateExerciseInput(form)
  if (Object.keys(formErrors.value).length) return
  if (editing.value) {
    await updateExercise(editing.value.id, { ...form })
    toast.success('Exercise updated')
  } else {
    await createExercise({ ...form })
    toast.success(`Added ${form.name.trim()}`)
  }
  formOpen.value = false
}, { errorTitle: 'Could not save the exercise' })

// ---- delete ---------------------------------------------------------------
const deleteTarget = ref<Exercise | null>(null)
const deleteOpen = ref(false)
const deleteUsage = ref<{ routines: string[]; loggedSessions: number } | null>(null)

async function askDelete(exercise: Exercise) {
  deleteTarget.value = exercise
  deleteUsage.value = await exerciseUsage(exercise.id)
  deleteOpen.value = true
}

const remove = useAction(async () => {
  if (!deleteTarget.value) return
  await deleteExercise(deleteTarget.value.id)
  toast.success(`Deleted ${deleteTarget.value.name}`)
  deleteOpen.value = false
})

const starter = useAction(async () => {
  const added = await addStarterLibrary()
  toast.success(added ? `Added ${plural(added, 'starter exercise')}` : 'You already have every starter exercise')
})
</script>

<template>
  <PageHeader title="Exercises" subtitle="Your move library. Edits here never change past workouts." sprite="dumbbell">
    <template #actions>
      <Button v-if="exercises && missingStarters > 0" variant="secondary" :disabled="starter.pending.value" @click="starter.run()">
        Add starter library
      </Button>
      <Button @click="openForm()"><PixelGlyph name="plus" /> New exercise</Button>
    </template>
  </PageHeader>

  <QueryState :loading="loading" :error="error">
    <EmptyState
      v-if="exercises && !exercises.length"
      title="No exercises yet"
      text="Add your own, or grab the starter library of common lifts. It only adds exercises — no fake history."
    >
      <Button variant="accent" :disabled="starter.pending.value" @click="starter.run()">Add starter library</Button>
      <Button variant="secondary" @click="openForm()">Create my own</Button>
    </EmptyState>

    <template v-else-if="exercises">
      <div class="mb-8 flex flex-wrap items-end gap-3">
        <div class="relative min-w-[220px] flex-1">
          <PixelGlyph name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input v-model="search" placeholder="Search exercises" aria-label="Search exercises" class="pl-10" />
        </div>
        <NativeSelect v-model="muscleFilter" aria-label="Filter by muscle group" class="w-44">
          <option value="">All muscles</option>
          <option v-for="m in MUSCLE_GROUPS" :key="m" :value="m">{{ m }}</option>
        </NativeSelect>
        <NativeSelect v-model="equipmentFilter" aria-label="Filter by equipment" class="w-44">
          <option value="">All equipment</option>
          <option v-for="e in EQUIPMENT" :key="e" :value="e">{{ e }}</option>
        </NativeSelect>
        <Button v-if="hasFilters" variant="ghost" @click="clearFilters">Clear</Button>
      </div>

      <EmptyState v-if="!filtered.length" compact sprite="dumbbell" title="No matches" text="Try a different search or filter.">
        <Button variant="secondary" @click="clearFilters">Clear filters</Button>
      </EmptyState>

      <div class="flex flex-col gap-9">
        <section v-for="g in grouped" :key="g.group" :aria-label="g.group">
          <h2 class="pixel-label mb-2 flex items-center gap-3">
            {{ g.group }} <span class="num text-ink-faint">{{ g.items.length }}</span>
            <span class="dotted-rule flex-1" />
          </h2>
          <ul>
            <li
              v-for="ex in g.items"
              :key="ex.id"
              class="group flex items-center gap-4 rounded-[5px] px-3 py-2.5 hover:bg-cream-200"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate font-bold">{{ ex.name }}</p>
                <p v-if="ex.notes" class="truncate text-sm text-ink-soft">{{ ex.notes }}</p>
              </div>
              <span class="w-28 shrink-0 text-sm text-ink-soft">{{ ex.equipment }}</span>
              <div class="flex shrink-0 gap-1 opacity-60 group-focus-within:opacity-100 group-hover:opacity-100">
                <Button variant="ghost" size="icon-sm" :aria-label="`Edit ${ex.name}`" @click="openForm(ex)"><PixelGlyph name="pencil" /></Button>
                <Button variant="ghost" size="icon-sm" :aria-label="`Delete ${ex.name}`" class="hover:text-berry-700" @click="askDelete(ex)">
                  <PixelGlyph name="trash" />
                </Button>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </QueryState>

  <Dialog v-model:open="formOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ editing ? 'Edit exercise' : 'New exercise' }}</DialogTitle>
        <DialogDescription>Bodyweight exercises let you log reps without a weight.</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" novalidate @submit.prevent="save.run()">
        <div class="flex flex-col gap-1.5">
          <Label for="ex-name">Name</Label>
          <Input id="ex-name" v-model="form.name" maxlength="80" :invalid="!!formErrors.name" autocomplete="off" />
          <p v-if="formErrors.name" class="text-sm text-berry-700">{{ formErrors.name }}</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label for="ex-muscle">Muscle group</Label>
            <NativeSelect id="ex-muscle" v-model="form.muscleGroup">
              <option v-for="m in MUSCLE_GROUPS" :key="m" :value="m">{{ m }}</option>
            </NativeSelect>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="ex-equipment">Equipment</Label>
            <NativeSelect id="ex-equipment" v-model="form.equipment">
              <option v-for="e in EQUIPMENT" :key="e" :value="e">{{ e }}</option>
            </NativeSelect>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="ex-notes">Notes <span class="font-normal text-ink-faint">(optional)</span></Label>
          <Textarea id="ex-notes" v-model="form.notes" maxlength="1000" placeholder="Cues, seat height, grip…" />
        </div>
        <DialogFooter>
          <Button variant="secondary" @click="formOpen = false">Cancel</Button>
          <Button type="submit" :disabled="save.pending.value">{{ editing ? 'Save changes' : 'Add exercise' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <ConfirmDialog
    v-model:open="deleteOpen"
    :title="`Delete ${deleteTarget?.name ?? 'exercise'}?`"
    confirm-label="Delete"
    tone="destructive"
    :pending="remove.pending.value"
    @confirm="remove.run()"
  >
    <div class="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
      <p v-if="deleteUsage?.routines.length">
        It will be removed from {{ plural(deleteUsage.routines.length, 'routine') }}: <strong class="text-ink">{{ deleteUsage.routines.join(', ') }}</strong>.
      </p>
      <p v-if="deleteUsage?.loggedSessions">
        Your {{ plural(deleteUsage.loggedSessions, 'logged workout') }} with it stay in History.
      </p>
      <p v-if="!deleteUsage?.routines.length && !deleteUsage?.loggedSessions">It isn't used anywhere yet.</p>
    </div>
  </ConfirmDialog>
</template>
