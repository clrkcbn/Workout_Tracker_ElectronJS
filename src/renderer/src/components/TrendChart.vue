<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration
} from 'chart.js'
import { formatDate, fromDayNumber } from '@/lib/dates'

Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend)

export interface TrendSeries {
  label: string
  /** Fixed per series meaning (never by rank) so colours stay stable across filters. */
  tone: 'primary' | 'secondary'
  points: Array<{ x: number; y: number }>
}

const props = defineProps<{
  series: TrendSeries[]
  /** Unit shown on the axis and in tooltips, e.g. "kg" or "reps". */
  unit: string
  label: string
  formatValue?: (value: number) => string
}>()

// Validated against the cream chart surface (CVD-safe pair); the second series is also dashed.
const TONES = {
  primary: { color: '#2f78b5', dash: [] as number[] },
  secondary: { color: '#c2602f', dash: [6, 4] }
}
const INK = '#2b2a33'
const MUTED = '#57535f'
const GRID = '#e8d6b4'

const canvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart<'line'> | null = null

const fmt = (v: number) => (props.formatValue ? props.formatValue(v) : v.toLocaleString(undefined, { maximumFractionDigits: 1 }))

function config(): ChartConfiguration<'line'> {
  const allX = props.series.flatMap((s) => s.points.map((p) => p.x))
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const pad = Math.max(1, Math.round((maxX - minX) * 0.03))
  return {
    type: 'line',
    data: {
      datasets: props.series.map((s) => ({
        label: s.label,
        data: s.points,
        borderColor: TONES[s.tone].color,
        backgroundColor: TONES[s.tone].color,
        borderDash: TONES[s.tone].dash,
        borderWidth: 2,
        pointRadius: s.points.length > 40 ? 2.5 : 4,
        pointHoverRadius: 6,
        pointBorderColor: '#fffaf0',
        pointBorderWidth: 2,
        tension: 0,
        spanGaps: true
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      layout: { padding: { top: 8, right: 8 } },
      scales: {
        x: {
          type: 'linear',
          min: minX - pad,
          max: maxX + pad,
          grid: { display: false },
          border: { color: INK, width: 2 },
          ticks: {
            color: MUTED,
            font: { family: 'Nunito Variable', size: 12 },
            maxTicksLimit: 6,
            callback: (value) => formatDate(fromDayNumber(Number(value)), 'short')
          }
        },
        y: {
          grace: '10%',
          grid: { color: GRID },
          border: { display: false },
          title: { display: true, text: props.unit, color: MUTED, font: { family: 'Nunito Variable', size: 12, weight: 'bold' } },
          ticks: { color: MUTED, font: { family: 'Nunito Variable', size: 12 }, maxTicksLimit: 6, callback: (v) => fmt(Number(v)) }
        }
      },
      plugins: {
        legend: {
          display: props.series.length > 1,
          position: 'top',
          align: 'start',
          labels: { color: INK, boxWidth: 18, boxHeight: 3, font: { family: 'Nunito Variable', size: 13, weight: 'bold' } }
        },
        tooltip: {
          backgroundColor: '#fffaf0',
          borderColor: INK,
          borderWidth: 2,
          cornerRadius: 4,
          titleColor: INK,
          bodyColor: INK,
          padding: 10,
          titleFont: { family: 'Nunito Variable', weight: 'bold' },
          bodyFont: { family: 'Nunito Variable' },
          callbacks: {
            title: (items) => (items[0] ? formatDate(fromDayNumber(items[0].parsed.x ?? 0), 'medium') : ''),
            label: (item) => ` ${item.dataset.label}: ${fmt(item.parsed.y ?? 0)} ${props.unit}`
          }
        }
      }
    }
  }
}

function render() {
  if (!canvas.value) return
  chart?.destroy()
  chart = new Chart(canvas.value, config())
}

onMounted(render)
watch(() => [props.series, props.unit], render, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="relative h-[260px] w-full">
    <canvas ref="canvas" role="img" :aria-label="label" />
  </div>
</template>
