import { Page } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'
import { clearErrors, readState, type DiagnosticEntry } from '../storage'

const h = (...args: any[]) => React.createElement(...args)

function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}

function ErrorCard({ entry }: { entry: DiagnosticEntry }) {
  const { TableRow, TableRowGroup } = Design
  const [expanded, setExpanded] = React.useState(false)

  return h(
    TableRowGroup,
    { title: `${entry.level.toUpperCase()} — ${formatTime(entry.timestamp)}` },
    h(TableRow, {
      label: entry.title,
      subLabel: entry.message,
      subLabelLineClamp: expanded ? 20 : 3,
      onPress: () => setExpanded(v => !v),
    }),
    expanded && entry.stack
      ? h(TableRow, {
          label: 'Stack trace',
          subLabel: entry.stack,
          subLabelLineClamp: 20,
          trailing: h(TableRow.TrailingText, { text: 'Copy' }),
          onPress: () => Clipboard.setString(entry.stack ?? ''),
        })
      : null,
  )
}

export function ErrorsTab() {
  const { ScrollView } = ReactNative
  const { Button, Stack, TableRow, TableRowGroup } = Design

  const [, rerender] = React.useReducer((n: number) => n + 1, 0)

  const { entries, enabled } = readState()

  const clear = async () => {
    await clearErrors()
    rerender()
  }

  const copyAll = () => {
    const text = entries
      .map(e => `[${formatTime(e.timestamp)}] ${e.title}\n${e.message}\n${e.stack ?? ''}`)
      .join('\n\n---\n\n')
    Clipboard.setString(text || 'No errors.')
  }

  return h(
    ScrollView,
    { contentContainerStyle: { paddingBottom: 32 } },
    h(
      Page,
      { spacing: 16 },
      h(
        TableRowGroup,
        { title: 'Summary' },
        h(TableRow, {
          label: 'Recorded errors',
          trailing: h(TableRow.TrailingText, { text: String(entries.length) }),
        }),
        h(TableRow, {
          label: 'Monitoring',
          trailing: h(TableRow.TrailingText, { text: enabled ? 'Active' : 'Paused' }),
        }),
      ),
      h(
        Stack,
        { direction: 'horizontal', spacing: 8 },
        h(Button, { text: 'Copy all', variant: 'secondary', grow: true, disabled: entries.length === 0, onPress: copyAll }),
        h(Button, { text: 'Clear', variant: 'destructive', grow: true, disabled: entries.length === 0, onPress: clear }),
      ),
      entries.length === 0
        ? h(TableRowGroup, { title: 'Errors' }, h(TableRow, { label: 'No errors recorded.' }))
        : entries.map(entry => h(ErrorCard, { key: entry.id, entry })),
    ),
  )
}
