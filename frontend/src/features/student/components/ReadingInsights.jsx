import { useMemo } from 'react'
import { SimpleGrid } from '@mantine/core'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { ChartCard } from '../../../components/charts/ChartCard.jsx'
import { chartMargin, useChartTheme } from '../../../components/charts/chartTheme.js'

/** Genre distribution donut + monthly borrowing trend, styled via the shared chart theme. */
export const ReadingInsights = ({ history }) => {
  const { axisProps, chartColors, gridProps, legendProps, tooltipProps } = useChartTheme()
  const genreData = useMemo(() => {
    const counts = {}
    history.forEach((r) => {
      const genres = (r.genre || 'Unknown').split(/[,;]/).map((g) => g.trim()).filter(Boolean)
      genres.forEach((g) => { counts[g] = (counts[g] || 0) + 1 })
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [history])

  const monthlyData = useMemo(() => {
    const counts = {}
    history.forEach((r) => {
      if (!r.borrowedDate) return
      const date = new Date(r.borrowedDate)
      if (Number.isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      counts[key] = (counts[key] || 0) + 1
    })
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }))
  }, [history])

  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
      <ChartCard title="Genre Distribution" isEmpty={genreData.length === 0} height={300}>
        <PieChart>
          <Pie data={genreData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90} innerRadius={40}>
            {genreData.map((_, index) => <Cell key={index} fill={chartColors[index % chartColors.length]} />)}
          </Pie>
          <RTooltip {...tooltipProps} formatter={(value, name) => [`${value} book${value !== 1 ? 's' : ''}`, name]} />
          <Legend {...legendProps} layout="horizontal" verticalAlign="bottom" align="center" />
        </PieChart>
      </ChartCard>

      <ChartCard title="Monthly Borrowing Trend" description="Last 12 months" isEmpty={monthlyData.length === 0} height={300}>
        <BarChart data={monthlyData} margin={chartMargin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <RTooltip {...tooltipProps} />
          <Bar dataKey="count" name="Books Borrowed" fill={chartColors[0]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartCard>
    </SimpleGrid>
  )
}

export default ReadingInsights
