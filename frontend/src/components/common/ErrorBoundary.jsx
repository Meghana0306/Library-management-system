import { Component } from 'react'
import { Button, Code, Group, Stack, Text, Title } from '@mantine/core'

/**
 * Catches render-time errors so one broken panel cannot take down the portal.
 * Reset clears the error and re-renders the subtree.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error', error, info)
  }

  handleReset() {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Stack gap="sm" p="lg" align="flex-start">
        <Title order={3}>{this.props.title || 'Something went wrong'}</Title>
        <Text size="sm" c="dimmed">
          This part of the page failed to render. You can try again, or reload the page.
        </Text>
        <Code block>{String(error.message || error)}</Code>
        <Group gap="xs">
          <Button variant="default" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Button onClick={this.handleReset}>Try again</Button>
        </Group>
      </Stack>
    )
  }
}

export default ErrorBoundary
