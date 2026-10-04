<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'
import QueryState from '@/components/QueryState.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input/Input.vue'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { usePreferences } from '@/composables/usePreferences'
import { formatDate, formatDuration, formatMonth, monthKey } from '@/lib/dates'
import { loadCompletedHistory } from '@/lib/repo/sessions'
import { sortSessionsChronologically, summarizeSets } from '@/lib/stats'
import { plural } from '@/lib/utils'

const { fmtWeight } = usePreferences()
const { data, loading, error } = useLiveQuery(loadCompletedHistory)
const search = ref('')

const rows = computed(() => {
  if (!data.value) return []
  const { sessions, exercises, sets } = data.value
  return sortSessionsChronologically(sessions)
    .reverse()
    .map((session) => {
      const exs = exercises.filter((e) => e.sessionId === session.id).sort((a, b) => a.position - b.position)
      return {
        session,
        names: exs.map((e) => e.name),
        summary: summarizeSets(sets.filter((s) => s.sessionId === session.id)),
        duration: session.finishedAt ? formatDuration(session.finishedAt - session.startedAt) : ''
      }
    })
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(
    (r) => r.session.routineName.toLowerCase().includes(q) || r.names.some((n) => n.toLowerCase().includes(q)) || r.session.notes.toLowerCase().includes(q)
  )
})

const months = computed(() => {
  const groups: Array<{ month: string; items: typeof filtered.value }> = []
  for (const row of filtered.value) {
    const m = monthKey(row.session.date)
    const last = groups[groups.length - 1]
    if (last?.month === m) last.items.push(row)
    else groups.push({ month: m, items: [row] })
  }
  return groups
})
</script>

<template>
  <PageHeader title="History" subtitle="Every finished workout. Open one to review or correct it." sprite="book" />

  <QueryState :loading="loading" :error="error">
    <EmptyState v-if="!rows.length" sprite="book" title="Your journal is empty" text="Finished workouts will show up here, newest first.">
      <Button as-child><RouterLink to="/workout">Start a workout</RouterLink></Button>
    </EmptyState>

    <template v-else>
      <div class="relative mb-8 max-w-md">
        <PixelGlyph name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <Input v-model="search" placeholder="Search by routine, exercise or note" aria-label="Search history" class="pl-10" />
      </div>

      <p v-if="!filtered.length" class="text-ink-soft">No workouts match “{{ search }}”.</p>

      <div class="flex flex-col gap-10">
        <section v-for="group in months" :key="group.month">
          <h2 class="pixel-label mb-2 flex items-center gap-3">
            {{ formatMonth(group.month) }} <span class="num text-ink-faint">{{ group.items.length }}</span>
            <span class="dotted-rule flex-1" />
          </h2>
          <ul>
            <li v-for="row in group.items" :key="row.session.id">
              <RouterLink
                :to="`/history/${row.session.id}`"
                class="grid grid-cols-[104px_minmax(0,1fr)_auto] items-center gap-4 rounded-[5px] px-3 py-3 hover:bg-cream-200"
              >
                <span class="num text-sm font-bold text-ink-soft">{{ formatDate(row.session.date, 'short') }}</span>
                <span class="min-w-0">
                  <span class="block truncate font-bold">{{ row.session.routineName }}</span>
                  <span class="block truncate text-sm text-ink-soft">{{ row.names.join(' · ') }}</span>
                </span>
                <span class="num text-right text-sm text-ink-soft">
                  {{ plural(row.summary.setCount, 'set') }}
                  <span v-if="row.summary.volumeKg" class="hidden sm:inline"> · {{ fmtWeight(row.summary.volumeKg) }}</span>
                  <span v-if="row.duration" class="block text-ink-faint">{{ row.duration }}</span>
                </span>
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </QueryState>
</template>
