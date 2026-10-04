import { defineComponent, h } from 'vue'
import { TabsList as RekaList, TabsTrigger as RekaTrigger } from 'reka-ui'

export { TabsRoot as Tabs, TabsContent } from 'reka-ui'

export const TabsList = defineComponent({
  name: 'TabsList',
  setup: (_, { slots, attrs }) => () =>
    h(RekaList, { ...attrs, class: 'inline-flex gap-1 rounded-[6px] border-2 border-ink bg-cream-200 p-1' }, slots)
})

export const TabsTrigger = defineComponent({
  name: 'TabsTrigger',
  props: { value: { type: String, required: true } },
  setup: (props, { slots }) => () =>
    h(
      RekaTrigger,
      {
        value: props.value,
        class: [
          'inline-flex h-9 items-center gap-2 rounded-[4px] px-3 text-sm font-bold text-ink-soft',
          'hover:text-ink data-[state=active]:bg-paper data-[state=active]:text-ink data-[state=active]:shadow-pixel-sm',
          'data-[state=active]:outline-2 data-[state=active]:outline-ink'
        ].join(' ')
      },
      slots
    )
})
