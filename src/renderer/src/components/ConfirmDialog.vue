<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle
} from 'reka-ui'
import { buttonVariants } from './ui/button'
import Input from './ui/input/Input.vue'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'default' | 'destructive'
    /** When set, the user must type this word to enable the confirm button. */
    requireText?: string
    pending?: boolean
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel', tone: 'default', pending: false }
)
const emit = defineEmits<{ confirm: [] }>()
const open = defineModel<boolean>('open', { default: false })

const typed = ref('')
watch(open, (value) => {
  if (value) typed.value = ''
})
const canConfirm = computed(() => !props.pending && (!props.requireText || typed.value.trim() === props.requireText))

function onConfirm(event: Event) {
  // Keep the dialog open; the parent closes it when the action succeeds.
  event.preventDefault()
  if (canConfirm.value) emit('confirm')
}
</script>

<template>
  <AlertDialogRoot v-model:open="open">
    <AlertDialogPortal>
      <AlertDialogOverlay class="fixed inset-0 z-40 bg-ink/35" />
      <AlertDialogContent
        class="pixel-box shadow-pixel-lg fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 p-6 focus:outline-none"
      >
        <AlertDialogTitle class="pixel-title text-lg">{{ title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="description" class="mt-2 text-ink-soft">{{ description }}</AlertDialogDescription>
        <slot />
        <div v-if="requireText" class="mt-4">
          <label class="text-sm text-ink-soft" for="confirm-text">
            Type <strong class="text-ink">{{ requireText }}</strong> to confirm.
          </label>
          <Input id="confirm-text" v-model="typed" class="mt-1" autocomplete="off" @keydown.enter="onConfirm" />
        </div>
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <AlertDialogCancel :class="buttonVariants({ variant: 'secondary' })">{{ cancelLabel }}</AlertDialogCancel>
          <AlertDialogAction
            :disabled="!canConfirm"
            :class="buttonVariants({ variant: tone === 'destructive' ? 'destructive' : 'default' })"
            @click="onConfirm"
          >
            {{ pending ? 'Working…' : confirmLabel }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
