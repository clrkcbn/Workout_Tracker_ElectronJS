import { defineComponent, h } from 'vue'
import { DialogDescription as RekaDescription, DialogTitle as RekaTitle } from 'reka-ui'

export { DialogRoot as Dialog, DialogClose, DialogTrigger } from 'reka-ui'
export { default as DialogContent } from './DialogContent.vue'

export const DialogHeader = defineComponent({
  name: 'DialogHeader',
  setup: (_, { slots }) => () => h('div', { class: 'mb-5 flex flex-col gap-1 pr-8' }, slots.default?.())
})

export const DialogFooter = defineComponent({
  name: 'DialogFooter',
  setup: (_, { slots }) => () => h('div', { class: 'mt-6 flex flex-wrap items-center justify-end gap-3' }, slots.default?.())
})

export const DialogTitle = defineComponent({
  name: 'DialogTitle',
  setup: (_, { slots }) => () => h(RekaTitle, { class: 'pixel-title text-lg text-ink' }, slots)
})

export const DialogDescription = defineComponent({
  name: 'DialogDescription',
  setup: (_, { slots }) => () => h(RekaDescription, { class: 'text-sm text-ink-soft' }, slots)
})
