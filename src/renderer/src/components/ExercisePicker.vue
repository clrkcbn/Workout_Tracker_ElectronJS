<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Input from '@/components/ui/input/Input.vue'
import NativeSelect from '@/components/ui/native-select/NativeSelect.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import { useLiveQuery } from '@/composables/useLiveQuery'
import { listExercises } from '@/lib/repo/exercises'
import { MUSCLE_GROUPS } from '@/lib/types'

const props = withDefaults(defineProps<{ title?: string; confirmLabel?: string; pending?: boolean }>(), {
  title: 'Add exercises',
  confirmLabel: 'Add',
  pending: false
})
const emit = defineEmits<{ pick: [ids: string[]] }>()
const open = defineModel<boolean>('open', { default: false })

const { data: exercises } = useLiveQuery(listExercises)
const search = ref('')
const muscle = ref('')
const selected = ref<string[]>([])

watch(open, (value) => {
  if (value) {
    search.value = ''
    selected.value = []
  }
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (exercises.value ?? []).filter((e) => (!q || e.name.toLowerCase().includes(q)) && (!muscle.value || e.muscleGroup === muscle.value))
})

function toggle(id: string) {
  const i = selected.value.indexOf(id)
  if (i >= 0) selected.value.splice(i, 1)
  else selected.value.push(id)
}

function confirm() {
  if (selected.value.length && !props.pending) emit('pick', [...selected.value])
}

function onSearchEnter() {
  // Enter on a single match adds it straight away.
  if (!selected.value.length && filtered.value.length === 1) selected.value = [filtered.value[0].id]
  confirm()
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="w-[min(620px,calc(100vw-32px))]">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>Pick one or more. They're added in the order you select them.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-wrap gap-3">
        <div class="relative min-w-[200px] flex-1">
          <PixelGlyph name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input v-model="search" placeholder="Search" aria-label="Search exercises" class="pl-10" @keydown.enter.prevent="onSearchEnter" />
        </div>
        <NativeSelect v-model="muscle" aria-label="Muscle group" class="w-40">
          <option value="">All muscles</option>
          <option v-for="m in MUSCLE_GROUPS" :key="m" :value="m">{{ m }}</option>
        </NativeSelect>
      </div>

      <div class="mt-4 h-[min(360px,45vh)] overflow-y-auto rounded-[5px] border-2 border-ink bg-cream-100 p-1.5">
        <p v-if="exercises && !exercises.length" class="p-6 text-center text-ink-soft">
          Your library is empty.
          <RouterLink to="/exercises" class="font-bold text-sky-700 underline" @click="open = false">Add exercises first</RouterLink>.
        </p>
        <p v-else-if="!filtered.length" class="p-6 text-center text-ink-soft">No exercises match.</p>
        <ul v-else role="listbox" aria-multiselectable="true" :aria-label="title">
          <li v-for="ex in filtered" :key="ex.id">
            <button
              type="button"
              role="option"
              :aria-selected="selected.includes(ex.id)"
              class="flex w-full items-center gap-3 rounded-[4px] px-3 py-2 text-left hover:bg-cream-200"
              :class="selected.includes(ex.id) && '!bg-leaf-100'"
              @click="toggle(ex.id)"
            >
              <span
                class="grid h-6 w-6 shrink-0 place-items-center rounded-[3px] border-2 border-ink"
                :class="selected.includes(ex.id) ? 'bg-leaf-500' : 'bg-paper'"
              >
                <span v-if="selected.includes(ex.id)" class="num text-xs font-extrabold">{{ selected.indexOf(ex.id) + 1 }}</span>
              </span>
              <span class="min-w-0 flex-1 truncate font-semibold">{{ ex.name }}</span>
              <span class="shrink-0 text-sm text-ink-soft">{{ ex.muscleGroup }} · {{ ex.equipment }}</span>
            </button>
          </li>
        </ul>
      </div>

      <DialogFooter>
        <Button variant="secondary" @click="open = false">Cancel</Button>
        <Button :disabled="!selected.length || pending" @click="confirm">
          {{ confirmLabel }}{{ selected.length ? ` ${selected.length}` : '' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
