import { cva, type VariantProps } from 'class-variance-authority'

export { default as Button } from './Button.vue'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none font-bold',
    'border-2 border-ink rounded-[5px] shadow-pixel',
    'transition-[transform,box-shadow] duration-75',
    'active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_var(--color-ink)]',
    'disabled:opacity-50 disabled:pointer-events-none disabled:shadow-pixel-sm'
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-leaf-500 text-ink hover:bg-leaf-300',
        secondary: 'bg-paper text-ink hover:bg-cream-200',
        accent: 'bg-sun-500 text-ink hover:bg-sun-300',
        sky: 'bg-sky-300 text-ink hover:bg-sky-100',
        destructive: 'bg-berry-500 text-paper hover:bg-berry-700',
        ghost:
          'border-transparent shadow-none bg-transparent hover:bg-cream-200 active:translate-x-0 active:translate-y-0 active:shadow-none',
        link: 'border-transparent shadow-none bg-transparent underline underline-offset-4 hover:text-sky-700 active:translate-x-0 active:translate-y-0 active:shadow-none'
      },
      size: {
        default: 'h-10 px-4 text-[15px]',
        sm: 'h-8 px-3 text-sm shadow-pixel-sm',
        lg: 'h-14 px-6 text-lg shadow-pixel-lg',
        icon: 'h-10 w-10 p-0',
        'icon-sm': 'h-8 w-8 p-0 shadow-pixel-sm'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
