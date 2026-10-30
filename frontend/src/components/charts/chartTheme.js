import { useMemo } from 'react'
import { useComputedColorScheme } from '@mantine/core'

/**
 * Shared recharts styling. Muted, low-chroma series so charts read as part of
 * the same product as the tables next to them — forest and amber lead, the
 * rest are earth tones that stay distinguishable at 2px stroke widths.
 *
 * recharts writes most of this straight onto SVG attributes, and SVG paint
 * attributes do not re-resolve reliably from a CSS custom property once a
 * chart has rendered. So the palette is resolved per colour scheme at render
 * time through `useChartTheme()` — never imported as a module-level constant —
 * which is what makes a light/dark toggle actually re-colour the charts.
 */
const SERIES = {
  light: ['#1d5c46', '#a97022', '#4f7d8a', '#8a5a4e', '#6b7f45', '#6f6659'],
  dark: ['#6fa189', '#ddaa4d', '#7fb0bd', '#d0917f', '#a8bd72', '#a4998a'],
}

/** Rating scales run bad → good, so they stay red → amber → green. */
const RATINGS = {
  light: ['#c25a4d', '#d97528', '#c98a2d', '#55a648', '#377a30'],
  dark: ['#e28b7c', '#eda667', '#ddaa4d', '#8fce85', '#6dbb61'],
}

const STATUS = {
  light: { approved: '#43903a', pending: '#c4631d', rejected: '#c25a4d' },
  dark: { approved: '#8fce85', pending: '#eda667', rejected: '#e28b7c' },
}

const SURFACE = {
  light: { text: '#6f6659', axis: '#d3c8b6', grid: '#ece5d8', cursor: '#f4efe4', panel: '#ffffff', border: '#e2d9c9', label: '#221f1a' },
  dark: { text: '#98a49c', axis: '#38423a', grid: '#2e372f', cursor: '#262e28', panel: '#1e2420', border: '#2e372f', label: '#e9ece9' },
}

export const chartMargin = { top: 8, right: 8, bottom: 0, left: -12 }

/**
 * Every recharts prop bag the app needs, resolved for the active scheme.
 * Consumers spread these onto XAxis/YAxis/CartesianGrid/Tooltip/Legend and
 * read `seriesColor(i)` for stroke/fill.
 */
export const useChartTheme = () => {
  const scheme = useComputedColorScheme('light', { getInitialValueInEffect: true })

  return useMemo(() => {
    const surface = SURFACE[scheme]
    const chartColors = SERIES[scheme]

    return {
      scheme,
      chartColors,
      ratingColors: RATINGS[scheme],
      statusColors: STATUS[scheme],
      seriesColor: (index) => chartColors[index % chartColors.length],

      axisProps: {
        tick: { fontSize: 12, fill: surface.text },
        tickLine: false,
        axisLine: { stroke: surface.axis },
        minTickGap: 8,
      },

      gridProps: {
        stroke: surface.grid,
        strokeDasharray: '3 3',
        vertical: false,
      },

      tooltipProps: {
        cursor: { fill: surface.cursor },
        contentStyle: {
          background: surface.panel,
          border: `1px solid ${surface.border}`,
          borderRadius: 6,
          boxShadow: 'none',
          color: surface.label,
          fontSize: 12,
          padding: '6px 8px',
        },
        itemStyle: { color: surface.label },
        labelStyle: { color: surface.label, fontWeight: 600, marginBottom: 2 },
      },

      legendProps: {
        iconType: 'plainline',
        wrapperStyle: { fontSize: 12, paddingTop: 8, color: surface.text },
      },

      chartMargin,
    }
  }, [scheme])
}
