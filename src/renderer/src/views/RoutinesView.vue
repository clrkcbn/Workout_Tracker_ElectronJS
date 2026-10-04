<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryState from '@/components/QueryState.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import { Button } from '@/components/ui/button'
import { useAction } from '@/composables/useAction'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { useToast } from '@/composables/useToast'
import { db } from '@/lib/db'
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from '@/lib/dates'
import { deleteRoutine, duplicateRoutine, listRoutines, routineScheduleUsage, type RoutineSummary } from '@/lib/repo/routines'
import { startSession } from '@/lib/repo/sessions'
import { plural } from '@/lib/utils'

const router = useRouter()
const toast = useToast()
const { data, loading, error } = useLiveQuery(async () => {
  const [routines, weekly] = await Promise.all([listRoutines(), db.weeklyPlan.toArray()])
  return { routines, weekly }
})

const routines = computed(() => data.value?.routines ?? [])
function scheduledDays(routineId: string) {
  const days = new Set((data.value?.weekly ?? []).filter((w) => w.routineId === routineId).map((w) => w.weekday))
  return WEEKDAY_ORDER.filter((d) => days.has(d)).map((d) => WEEKDAY_SHORT[d])
}

const duplicate = useAction(async (routine: RoutineSummary) => {
  const id = await duplicateRoutine(routine.id)
  toast.success(`Duplicated ${routine.name}`)
  await router.push(`/routines/${id}`)
})

const start = useAction(async (routine: RoutineSummary) => {
  const result = await startSession({ routineId: routine.id })
  if (result.resumed) toast.info('You already have a workout going', 'Finish or discard it first to start a new one.')
  await router.push('/workout')
})

const deleteTarget = ref<RoutineSummary | null>(null)
const deleteOpen = ref(false)
const deleteInfo = ref<{ weekdays: number[]; overrides: number } | null>(null)
async function askDelete(routine: RoutineSummary) {
  deleteTarget.value = routine
  deleteInfo.value = await routineScheduleUsage(routine.id)
  deleteOpen.value = true
}
const deleteDays = computed(() => (deleteInfo.value?.weekdays ?? []).map((d) => WEEKDAY_SHORT[d]).join(', '))
const remove = useAction(async () => {
  if (!deleteTarget.value) return
  await deleteRoutine(deleteTarget.value.id)
  toast.success(`Deleted ${deleteTarget.value.name}`)
  deleteOpen.value = false
})
</script>

<template>
  <PageHeader title="Routines" subtitle="Reusable workout plans. Mix and match any split you like." sprite="clipboard">
    <template #actions>
      <Button as-child><RouterLink to="/routines/new"><PixelGlyph name="plus" /> New routine</RouterLink></Button>
    </template>
  </PageHeader>

  <QueryState :loading="loading" :error="error">
    <EmptyState
      v-if="!routines.length"
      sprite="clipboard"
      title="No routines yet"
      text="A routine is a list of exercises with target sets, reps and rest. Make one for each kind of day you train."
    >
      <Button as-child variant="accent"><RouterLink to="/routines/new">Build your first routine</RouterLink></Button>
    </EmptyState>

    <ul v-else class="grid gap-6 md:grid-cols-2">
      <li v-for="routine in routines" :key="routine.id" class="pixel-box flex flex-col p-5">
        <div class="flex items-start justify-between gap-3">
          <RouterLink :to="`/routines/${routine.id}`" class="min-w-0 hover:underline">
            <h2 class="pixel-title truncate text-lg">{{ routine.name }}</h2>
          </RouterLink>
          <span class="shrink-0 text-sm text-ink-soft">{{ plural(routine.items.length, 'exercise') }}</span>
        </div>
        <p class="mt-1 text-sm text-ink-soft">
          <template v-if="scheduledDays(routine.id).length">Every {{ scheduledDays(routine.id).join(', ') }}</template>
          <template v-else>Not on the weekly schedule</template>
        </p>
        <p v-if="routine.items.length" class="mt-3 line-clamp-2 text-sm">
          {{ routine.items.map((i) => i.exercise?.name ?? 'Deleted exercise').join(' · ') }}
        </p>
        <p v-else class="mt-3 text-sm text-ink-faint">No exercises yet.</p>

        <div class="mt-auto flex flex-wrap items-center gap-2 pt-5">
          <Button size="sm" :disabled="!routine.items.length || start.pending.value" @click="start.run(routine)">
            <PixelGlyph name="play" /> Start
          </Button>
          <Button size="sm" variant="secondary" as-child><RouterLink :to="`/routines/${routine.id}`">Edit</RouterLink></Button>
          <Button size="sm" variant="ghost" :disabled="duplicate.pending.value" @click="duplicate.run(routine)">
            <PixelGlyph name="copy" /> Duplicate
          </Button>
          <Button size="icon-sm" variant="ghost" class="ml-auto hover:text-berry-700" :aria-label="`Delete ${routine.name}`" @click="askDelete(routine)">
            <PixelGlyph name="trash" />
          </Button>
        </div>
      </li>
    </ul>
  </QueryState>

  <ConfirmDialog
    v-model:open="deleteOpen"
    :title="`Delete ${deleteTarget?.name ?? 'routine'}?`"
    confirm-label="Delete routine"
    tone="destructive"
    :pending="remove.pending.value"
    @confirm="remove.run()"
  >
    <div class="mt-3 flex flex-col gap-2 text-sm text-ink-soft">
      <p v-if="deleteInfo?.weekdays.length || deleteInfo?.overrides">
        It will be cleared from your schedule
        <template v-if="deleteDays">({{ deleteDays }})</template>.
      </p>
      <p>Workouts you already logged with it stay in History.</p>
    </div>
  </ConfirmDialog>
</template>
