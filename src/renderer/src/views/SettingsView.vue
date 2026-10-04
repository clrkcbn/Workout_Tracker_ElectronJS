<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'
import PixelSprite from '@/components/pixel/PixelSprite.vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import NativeSelect from '@/components/ui/native-select/NativeSelect.vue'
import SegmentedControl from '@/components/ui/segmented/SegmentedControl.vue'
import { useAction } from '@/composables/useAction'
import { usePreferences } from '@/composables/usePreferences'
import { useToast } from '@/composables/useToast'
import { backupFileName, createBackup, resetAllData, restoreBackup, validateBackup, type BackupFile, type BackupPreview } from '@/lib/backup'
import { formatDate } from '@/lib/dates'
import { addStarterLibrary } from '@/lib/repo/exercises'
import { setPreference } from '@/lib/repo/settings'
import type { Unit } from '@/lib/types'
import { plural } from '@/lib/utils'
import type { AppInfo } from '../../../preload/api'

const toast = useToast()
const { prefs } = usePreferences()
const appInfo = ref<AppInfo | null>(null)
onMounted(async () => {
  appInfo.value = (await window.desktop?.getAppInfo().catch(() => null)) ?? null
})

// ---- preferences --------------------------------------------------------------
const unitModel = computed<Unit>({
  get: () => prefs.unit,
  set: (value) => void savePref.run('unit', value)
})
const soundModel = computed<'on' | 'off'>({
  get: () => (prefs.timerSound ? 'on' : 'off'),
  set: (value) => void savePref.run('timerSound', value === 'on')
})
const restModel = computed<string>({
  get: () => String(prefs.defaultRestSeconds),
  set: (value) => void savePref.run('defaultRestSeconds', Number(value))
})
const savePref = useAction(async (key: 'unit' | 'timerSound' | 'defaultRestSeconds', value: Unit | boolean | number) => {
  await setPreference(key, value as never)
  if (key === 'unit') toast.success(`Showing weights in ${value}`, 'Every saved weight was converted for display.')
})

// ---- export -------------------------------------------------------------------
const exportAction = useAction(async () => {
  const backup = await createBackup()
  const json = JSON.stringify(backup, null, 2)
  if (window.desktop) {
    const result = await window.desktop.saveBackup(json, backupFileName())
    if (result.ok) toast.success('Backup saved', result.path)
    else if ('error' in result) throw new Error(result.error)
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: backupFileName() })
    a.click()
    URL.revokeObjectURL(url)
  }
}, { errorTitle: 'Could not export' })

// ---- import -------------------------------------------------------------------
const importErrors = ref<string[]>([])
const importFileName = ref('')
// shallowRef: the backup rows must stay plain objects (Vue proxies can't be stored in IndexedDB).
const pendingBackup = shallowRef<{ backup: BackupFile; preview: BackupPreview } | null>(null)
const previewOpen = ref(false)
const errorOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function inspect(content: string, name: string) {
  importFileName.value = name
  const result = validateBackup(content)
  if (!result.ok) {
    importErrors.value = result.errors
    errorOpen.value = true
    return
  }
  pendingBackup.value = { backup: result.backup, preview: result.preview }
  previewOpen.value = true
}

const chooseFile = useAction(async () => {
  if (!window.desktop) {
    fileInput.value?.click()
    return
  }
  const result = await window.desktop.openBackup()
  if (result.ok) inspect(result.content, result.name)
  else if ('error' in result) throw new Error(result.error)
}, { errorTitle: 'Could not open the file' })

async function onBrowserFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) inspect(await file.text(), file.name)
  ;(event.target as HTMLInputElement).value = ''
}

const restore = useAction(async () => {
  if (!pendingBackup.value) return
  await restoreBackup(pendingBackup.value.backup)
  previewOpen.value = false
  pendingBackup.value = null
  toast.success('Backup restored', 'Your journal now matches the backup file.')
}, { errorTitle: 'Restore failed — nothing was changed' })

const previewRows = computed(() => {
  const c = pendingBackup.value?.preview.counts
  if (!c) return []
  return [
    ['Exercises', c.exercises],
    ['Routines', c.routines],
    ['Workouts', c.sessions],
    ['Logged sets', c.loggedSets],
    ['Bodyweight entries', c.bodyweights],
    ['Schedule days & changes', c.weeklyPlan + c.scheduleOverrides]
  ] as const
})

// ---- other ----------------------------------------------------------------------
const starter = useAction(async () => {
  const added = await addStarterLibrary()
  toast.success(added ? `Added ${plural(added, 'exercise')}` : 'You already have every starter exercise')
})

const resetOpen = ref(false)
const reset = useAction(async () => {
  await resetAllData()
  resetOpen.value = false
  toast.success('All data erased', 'Fresh journal, fresh start.')
})
</script>

<template>
  <PageHeader title="Settings" subtitle="Units, timer, backups and housekeeping." sprite="gear" />

  <div class="flex max-w-3xl flex-col gap-12">
    <!-- Preferences -->
    <section aria-labelledby="pref-heading">
      <h2 id="pref-heading" class="pixel-label mb-4">Preferences</h2>
      <div class="flex flex-col divide-y-2 divide-dashed divide-cream-300">
        <div class="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p class="font-bold">Weight unit</p>
            <p class="text-sm text-ink-soft">Weights are stored precisely and converted for display, so switching never loses accuracy.</p>
          </div>
          <SegmentedControl
            v-model="unitModel"
            label="Weight unit"
            :options="[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' }
            ]"
          />
        </div>
        <div class="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p class="font-bold">Default rest for new exercises</p>
            <p class="text-sm text-ink-soft">Routines can set their own rest per exercise.</p>
          </div>
          <NativeSelect v-model="restModel" aria-label="Default rest" class="w-40">
            <option v-for="s in [30, 45, 60, 75, 90, 120, 150, 180, 240, 300]" :key="s" :value="String(s)">
              {{ s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min` }}
            </option>
          </NativeSelect>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <p class="font-bold">Rest timer chime</p>
            <p class="text-sm text-ink-soft">Plays while the app is open. There are no reminders when it's closed.</p>
          </div>
          <SegmentedControl
            v-model="soundModel"
            label="Rest timer chime"
            :options="[
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' }
            ]"
          />
        </div>
      </div>
    </section>

    <!-- Backups -->
    <section aria-labelledby="backup-heading">
      <h2 id="backup-heading" class="pixel-label mb-4">Backups</h2>
      <div class="pixel-box flex flex-col gap-5 p-6">
        <div class="flex items-start gap-4">
          <PixelSprite name="book" :scale="2" class="shrink-0" />
          <p class="text-ink-soft">
            Your journal lives only on this computer. Export a backup now and then and keep a copy somewhere safe (a USB stick or a cloud folder).
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <Button variant="accent" :disabled="exportAction.pending.value" @click="exportAction.run()"><PixelGlyph name="export" /> Export backup</Button>
          <Button variant="secondary" :disabled="chooseFile.pending.value" @click="chooseFile.run()"><PixelGlyph name="import" /> Restore from backup…</Button>
          <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" @change="onBrowserFile" />
        </div>
      </div>
    </section>

    <!-- Library -->
    <section aria-labelledby="library-heading">
      <h2 id="library-heading" class="pixel-label mb-4">Exercise library</h2>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <p class="text-ink-soft">Add common lifts you don't have yet. Existing exercises and history are untouched.</p>
        <Button variant="secondary" :disabled="starter.pending.value" @click="starter.run()">Add starter exercises</Button>
      </div>
    </section>

    <!-- Danger zone -->
    <section aria-labelledby="danger-heading">
      <h2 id="danger-heading" class="pixel-label mb-4 !text-berry-700">Danger zone</h2>
      <div class="flex flex-wrap items-center justify-between gap-4 rounded-[6px] border-2 border-berry-700 bg-berry-100 p-5">
        <div>
          <p class="font-bold">Erase all data</p>
          <p class="text-sm text-ink-soft">Deletes every exercise, routine, workout and measurement on this computer.</p>
        </div>
        <Button variant="destructive" @click="resetOpen = true">Erase everything…</Button>
      </div>
    </section>

    <!-- About -->
    <section aria-labelledby="about-heading" class="text-sm text-ink-soft">
      <h2 id="about-heading" class="pixel-label mb-2">About</h2>
      <p>Pixel Gym Journal {{ appInfo?.version ? `v${appInfo.version}` : '' }} · works fully offline.</p>
      <p v-if="appInfo" class="mt-1 break-all">Data folder: <code class="text-ink">{{ appInfo.dataPath }}</code></p>
    </section>
  </div>

  <!-- Import preview -->
  <Dialog v-model:open="previewOpen">
    <DialogContent v-if="pendingBackup">
      <DialogHeader>
        <DialogTitle>Restore this backup?</DialogTitle>
        <DialogDescription>
          {{ importFileName }}
          <template v-if="pendingBackup.preview.exportedAt"> · exported {{ new Date(pendingBackup.preview.exportedAt).toLocaleString() }}</template>
        </DialogDescription>
      </DialogHeader>
      <dl class="grid grid-cols-2 gap-x-6 gap-y-1.5">
        <template v-for="[label, count] in previewRows" :key="label">
          <dt class="text-ink-soft">{{ label }}</dt>
          <dd class="num text-right font-bold">{{ count }}</dd>
        </template>
      </dl>
      <p v-if="pendingBackup.preview.firstWorkout" class="mt-3 text-sm text-ink-soft">
        Workouts from {{ formatDate(pendingBackup.preview.firstWorkout) }} to {{ formatDate(pendingBackup.preview.lastWorkout!) }}.
      </p>
      <div class="mt-5 rounded-[5px] border-2 border-berry-700 bg-berry-100 p-3 text-sm">
        <strong>This replaces everything currently in the app.</strong> Export a backup first if you might want today's data back.
      </div>
      <DialogFooter>
        <Button variant="secondary" @click="previewOpen = false">Cancel</Button>
        <Button variant="destructive" :disabled="restore.pending.value" @click="restore.run()">
          {{ restore.pending.value ? 'Restoring…' : 'Replace my data' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Invalid file -->
  <Dialog v-model:open="errorOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>That file can't be restored</DialogTitle>
        <DialogDescription>{{ importFileName }} — nothing was changed.</DialogDescription>
      </DialogHeader>
      <ul class="list-disc space-y-1 pl-5 text-sm">
        <li v-for="e in importErrors" :key="e">{{ e }}</li>
      </ul>
      <DialogFooter>
        <Button @click="errorOpen = false">OK</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <ConfirmDialog
    v-model:open="resetOpen"
    title="Erase all data?"
    description="Every exercise, routine, schedule, workout and bodyweight entry will be permanently deleted. Consider exporting a backup first."
    confirm-label="Erase everything"
    tone="destructive"
    require-text="ERASE"
    :pending="reset.pending.value"
    @confirm="reset.run()"
  />
</template>
