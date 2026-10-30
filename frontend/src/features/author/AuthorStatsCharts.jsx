import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button, Group } from '@mantine/core'
import { ChartCard } from '../../components/charts/ChartCard.jsx'
import { chartMargin, useChartTheme } from '../../components/charts/chartTheme'

const rotated = (axisProps) => ({ ...axisProps, angle: -35, textAnchor: 'end', interval: 0, height: 70 })

export const PortfolioChart = ({ data }) => {
  const { legendProps, statusColors, tooltipProps } = useChartTheme()
  const statusColorMap = {
    Published: statusColors.approved,
    Pending: statusColors.pending,
    Rejected: statusColors.rejected,
  }

  return (
    <ChartCard
      title="Book Portfolio Breakdown"
      height={260}
      isEmpty={data.length === 0}
      emptyLabel="No books submitted yet."
    >
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={statusColorMap[entry.name]} />
          ))}
        </Pie>
        <Legend {...legendProps} />
        <Tooltip {...tooltipProps} formatter={(value) => [value, 'Books']} />
      </PieChart>
    </ChartCard>
  )
}

export const RatingDistributionChart = ({ data, isEmpty }) => {
  const { axisProps, gridProps, ratingColors, tooltipProps } = useChartTheme()

  return (
    <ChartCard title="Rating Distribution" height={260} isEmpty={isEmpty} emptyLabel="No reviews yet.">
      <BarChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipProps} />
        <Bar dataKey="count" name="Reviews" radius={[2, 2, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={ratingColors[Number(entry.star) - 1]} />
          ))}
        </Bar>
      </BarChart>
    </ChartCard>
  )
}

export const CountPerBookChart = ({ title, data, dataKey, name, isEmpty, emptyLabel, colorIndex = 0 }) => {
  const { axisProps, gridProps, seriesColor, tooltipProps } = useChartTheme()

  return (
    <ChartCard title={title} height={300} isEmpty={isEmpty} emptyLabel={emptyLabel}>
      <BarChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="name" {...rotated(axisProps)} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipProps} />
        <Bar dataKey={dataKey} name={name} fill={seriesColor(colorIndex)} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartCard>
  )
}

export const RatingPerBookChart = ({ data }) => {
  const { axisProps, gridProps, seriesColor, tooltipProps } = useChartTheme()

  return (
    <ChartCard title="Average Rating per Published Book" height={300} isEmpty={data.length === 0}>
      <BarChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="name" {...rotated(axisProps)} />
        <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} {...axisProps} />
        <Tooltip {...tooltipProps} />
        <Bar dataKey="rating" name="Avg Rating" fill={seriesColor(2)} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ChartCard>
  )
}

export const BorrowTrendsChart = ({ data, loading, period, onPeriodChange }) => {
  const { axisProps, gridProps, seriesColor, tooltipProps } = useChartTheme()

  return (
    <ChartCard
      title="Borrow Trends Over Time"
      height={300}
      loading={loading}
      isEmpty={data.length === 0}
      emptyLabel="No borrow history to show."
      actions={(
        <Group gap={4}>
          {['monthly', 'weekly'].map((value) => (
            <Button
              key={value}
              size="compact-xs"
              variant={period === value ? 'light' : 'subtle'}
              color="gray"
              onClick={() => onPeriodChange(value)}
            >
              {value === 'monthly' ? 'Monthly' : 'Weekly'}
            </Button>
          ))}
        </Group>
      )}
    >
      <LineChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="period" {...rotated(axisProps)} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip
          {...tooltipProps}
          formatter={(value) => [value, 'Borrows']}
          labelFormatter={(label) => `Period: ${label}`}
        />
        <Line
          type="monotone"
          dataKey="count"
          name="Borrows"
          stroke={seriesColor(0)}
          strokeWidth={2}
          dot={{ r: 3, fill: seriesColor(0) }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartCard>
  )
}
