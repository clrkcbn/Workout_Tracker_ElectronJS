<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import PixelSprite from '@/components/pixel/PixelSprite.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { usePreferences } from '@/composables/usePreferences'
import { formatDuration } from '@/lib/dates'
import { loadCompletedHistory, loadSessionDetail } from '@/lib/repo/sessions'
import { buildExerciseHistories, computeRecords, RECORD_LABELS, summarizeSets } from '@/lib/stats'
import { plural } from '@/lib/utils'

const props = defineProps<{ sessionId: string }>()
const emit = defineEmits<{ close: [] }>()
const router = useRouter()
const { fmtWeight } = usePreferences()

const { data } = useLiveQuery(async () => {
  const [detail, history] = await Promise.all([loadSessionDetail(props.sessionId), loadCompletedHistory()])
  const records = computeRecords(buildExerciseHistories(history)).events.filter((e) => e.sessionId === props.sessionId)
  return { detail, records }
})

const summary = computed(() => (data.value?.detail ? summarizeSets(data.value.detail.exercises.flatMap((e) => e.sets)) : null))
const duration = computed(() => {
  const s = data.value?.detail?.session
  return s?.finishedAt ? formatDuration(s.finishedAt - s.startedAt) : ''
})

function go(path: string) {
  emit('close')
  void router.push(path)
}
</script>

<template>
  <Dialog :open="true" @update:open="(v) => !v && go('/')">
    <DialogContent class="text-center" hide-close>
      <div class="relative mx-auto mb-2 w-fit">
        <PixelSprite name="trophy" :scale="5" class="animate-pop" />
        <PixelSprite name="star" :scale="1" class="absolute -left-6 top-0 animate-sparkle" />
        <PixelSprite name="star" :scale="1" class="absolute -right-5 top-6 animate-sparkle [animation-delay:300ms]" />
      </div>
      <DialogTitle>Workout complete!</DialogTitle>
      <DialogDescription>Another page in the journal. Be proud of that.</DialogDescription>

      <dl v-if="summary" class="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
        <div>
          <dt class="pixel-label">Sets</dt>
          <dd class="num text-2xl font-extrabold">{{ summary.setCount }}</dd>
        </div>
        <div>
          <dt class="pixel-label">Reps</dt>
          <dd class="num text-2xl font-extrabold">{{ summary.totalReps }}</dd>
        </div>
        <div>
          <dt class="pixel-label">Time</dt>
          <dd class="num text-2xl font-extrabold">{{ duration || '—' }}</dd>
        </div>
      </dl>

      <div v-if="data?.records.length" class="mt-6 rounded-[6px] border-2 border-ink bg-sun-100 p-4 text-left">
        <p class="pixel-label mb-2 !text-ink">{{ plural(data.records.length, 'new record') }}!</p>
        <ul class="flex flex-col gap-1.5">
          <li v-for="r in data.records" :key="`${r.exerciseId}-${r.type}`" class="flex items-center gap-2">
            <PixelSprite name="star" :scale="1" />
            <span class="font-bold">{{ r.exerciseName }}</span>
            <span class="text-sm text-ink-soft">
              {{ RECORD_LABELS[r.type] }}: <strong class="num text-ink">{{ r.type === 'reps' ? `${r.value} reps` : fmtWeight(r.value) }}</strong>
            </span>
          </li>
        </ul>
      </div>

      <div class="mt-7 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" @click="go(`/history/${sessionId}`)">View details</Button>
        <Button @click="go('/')">Back to Today</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
