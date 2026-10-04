<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal } from 'reka-ui'
import { cn } from '@/lib/utils'
import PixelGlyph from '@/components/pixel/PixelGlyph.vue'

const props = withDefaults(defineProps<{ class?: HTMLAttributes['class']; hideClose?: boolean }>(), { hideClose: false })
const emit = defineEmits<{ openAutoFocus: [Event] }>()
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 z-40 bg-ink/35" />
    <DialogContent
      :class="
        cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[min(560px,calc(100vw-32px))] max-h-[calc(100vh-48px)] overflow-y-auto',
          'pixel-box shadow-pixel-lg p-6 focus:outline-none',
          props.class
        )
      "
      @open-auto-focus="emit('openAutoFocus', $event)"
    >
      <slot />
      <DialogClose
        v-if="!hideClose"
        class="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-[4px] text-ink-soft hover:bg-cream-200 hover:text-ink"
        aria-label="Close"
      >
        <PixelGlyph name="close" :size="16" />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
