import {
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Modal,
  MultiSelect,
  Notification,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Table,
  Tabs,
  Textarea,
  TextInput,
  Tooltip,
  createTheme,
} from '@mantine/core'

/**
 * Theme v2 — "warm bookish". A modern reading room: warm paper, deep forest
 * green, amber. Deliberately NOT violet, and deliberately not a cold slate:
 * this is a library, so the neutrals carry a paper tint and the primary is a
 * bound-cloth green.
 *
 * Shade 7 (#1d5c46) is the light-scheme primary — 7.9:1 on white. Shade 4 is
 * the dark-scheme primary — 5.4:1 on the dark surface, and light enough that
 * `autoContrast` puts near-black text on filled buttons.
 */
const forest = [
  '#eef4f0',
  '#dce8e1',
  '#b8d0c3',
  '#91b7a3',
  '#6fa189',
  '#4e8a70',
  '#37725a',
  '#1d5c46',
  '#164a38',
  '#0f3729',
]

/**
 * Accent only: highlights, star ratings, the active-nav marker, unread dots.
 * Never a second primary — there is still at most one filled primary per view.
 */
const amber = [
  '#fdf6e9',
  '#f8ecd6',
  '#f0d7a8',
  '#e7c076',
  '#ddaa4d',
  '#d29a37',
  '#c98a2d',
  '#a97022',
  '#87591c',
  '#6b4514',
]

/**
 * Warm neutrals replacing Mantine's blue-tinted gray. Shade 0 is the paper
 * background, 3/4 are the borders, 6 is dimmed text (5.2:1 on paper).
 */
const parchment = [
  '#faf6ef',
  '#f4efe4',
  '#ece5d8',
  '#e2d9c9',
  '#d3c8b6',
  '#a99e8b',
  '#6f6659',
  '#574f43',
  '#3d362c',
  '#26211a',
]

/**
 * Dark scheme. Warm charcoal-green rather than neutral black: 9 is the page
 * ground, 7 is every surface (Mantine maps `--mantine-color-body` to dark-7,
 * which Paper/Card/Modal/Menu all read), 4 is the border.
 */
const charcoal = [
  '#e9ece9',
  '#cbd2cc',
  '#98a49c',
  '#6d7a72',
  '#2e372f',
  '#38423a',
  '#262e28',
  '#1e2420',
  '#191e1b',
  '#151a17',
]

/**
 * Status ramps, hue-shifted warm but kept on Mantine's luminance ladder so the
 * light/dark Badge contrast maths still hold. green = approved/active,
 * orange = pending/in-flight, red = rejected/overdue.
 */
const leaf = [
  '#eef7ec',
  '#d9efd5',
  '#b6e0af',
  '#8fce85',
  '#6dbb61',
  '#55a648',
  '#43903a',
  '#377a30',
  '#2d6528',
  '#24511f',
]

const ochre = [
  '#fdf3e8',
  '#fae3cd',
  '#f4c69b',
  '#eda667',
  '#e58b40',
  '#d97528',
  '#c4631d',
  '#a75218',
  '#8a4414',
  '#6f3711',
]

const brick = [
  '#fdf2f0',
  '#fbe2dd',
  '#f6c6bd',
  '#eea79b',
  '#e28b7c',
  '#d47163',
  '#c25a4d',
  '#ab4a3f',
  '#8f3c33',
  '#74302a',
]

const BODY_FONT =
  '"Inter Variable", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

/** One serif, used for headings, the wordmark and page titles — nothing else. */
const DISPLAY_FONT =
  '"Source Serif 4 Variable", "Source Serif 4", Georgia, "Iowan Old Style", "Times New Roman", serif'

export const theme = createTheme({
  primaryColor: 'forest',
  primaryShade: { light: 7, dark: 4 },
  autoContrast: true,
  defaultRadius: 'md',
  colors: {
    forest,
    amber,
    gray: parchment,
    dark: charcoal,
    green: leaf,
    orange: ochre,
    red: brick,
  },
  white: '#ffffff',
  black: '#221f1a',

  fontFamily: BODY_FONT,
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',

  headings: {
    fontFamily: DISPLAY_FONT,
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '26px', lineHeight: '1.25', fontWeight: '600' },
      h2: { fontSize: '21px', lineHeight: '1.3', fontWeight: '600' },
      h3: { fontSize: '17px', lineHeight: '1.35', fontWeight: '600' },
      h4: { fontSize: '15px', lineHeight: '1.45', fontWeight: '600' },
      h5: { fontSize: '14px', lineHeight: '1.45', fontWeight: '600' },
      h6: { fontSize: '13px', lineHeight: '1.45', fontWeight: '600' },
    },
  },

  // Still nothing rounder than 8px anywhere in the product.
  radius: {
    xs: '2px',
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '8px',
  },

  // Warm-tinted and shallow: borders still carry the structure, shadows only
  // separate a surface from the paper behind it.
  shadows: {
    xs: '0 1px 2px rgba(58, 46, 28, 0.06)',
    sm: '0 1px 3px rgba(58, 46, 28, 0.09), 0 1px 2px rgba(58, 46, 28, 0.04)',
    md: '0 2px 8px rgba(58, 46, 28, 0.10)',
    lg: '0 6px 18px rgba(58, 46, 28, 0.12)',
    xl: '0 10px 28px rgba(58, 46, 28, 0.14)',
  },

  components: {
    Button: Button.extend({
      defaultProps: { size: 'sm' },
    }),
    Card: Card.extend({
      defaultProps: { withBorder: true, shadow: 'xs', radius: 'md', padding: 'md' },
    }),
    Paper: Paper.extend({
      defaultProps: { withBorder: true, shadow: undefined, radius: 'md' },
    }),
    Table: Table.extend({
      defaultProps: {
        highlightOnHover: true,
        withTableBorder: true,
        verticalSpacing: 'xs',
        horizontalSpacing: 'sm',
        fz: 'sm',
      },
    }),
    Modal: Modal.extend({
      defaultProps: {
        centered: true,
        radius: 'md',
        overlayProps: { blur: 0, backgroundOpacity: 0.5 },
      },
    }),
    Badge: Badge.extend({
      defaultProps: { variant: 'light', radius: 'sm' },
    }),
    Notification: Notification.extend({
      defaultProps: { radius: 'md', withBorder: true },
    }),
    Tooltip: Tooltip.extend({
      defaultProps: { withArrow: true, fz: 'xs' },
    }),
    Tabs: Tabs.extend({
      defaultProps: { variant: 'default', keepMounted: false },
    }),
    Anchor: Anchor.extend({
      defaultProps: { underline: 'hover' },
    }),
    TextInput: TextInput.extend({ defaultProps: { size: 'sm' } }),
    PasswordInput: PasswordInput.extend({ defaultProps: { size: 'sm' } }),
    Textarea: Textarea.extend({ defaultProps: { size: 'sm' } }),
    Select: Select.extend({ defaultProps: { size: 'sm' } }),
    MultiSelect: MultiSelect.extend({ defaultProps: { size: 'sm' } }),
    NumberInput: NumberInput.extend({ defaultProps: { size: 'sm' } }),
    Checkbox: Checkbox.extend({ defaultProps: { size: 'sm' } }),
  },
})

/** Status → Badge colour, per the theme contract (green/orange/red/gray only). */
export const statusColor = (status) => {
  const value = String(status || '').toUpperCase()
  if (['APPROVED', 'ACTIVE', 'RETURNED', 'AVAILABLE', 'FULFILLED', 'RESOLVED', 'COMPLETED'].includes(value)) {
    return 'green'
  }
  if (['PENDING', 'BORROWED', 'IN_PROGRESS', 'PROCESSING', 'LIMITED'].includes(value)) {
    return 'orange'
  }
  if (['REJECTED', 'OVERDUE', 'INACTIVE', 'FAILED', 'UNAVAILABLE', 'FLAGGED'].includes(value)) {
    return 'red'
  }
  return 'gray'
}

export default theme
