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
          onPress: () => {
            Clipboard.setString(entry.stack ?? '')
          },
          trailing: h(Design.Text, { variant: 'text-sm/medium', color: 'text-muted' }, 'Copy'),
        })
      : null,
  )
}

export function ErrorsTab() {
  const { ScrollView, View } = ReactNative
  const { Button, Text, TableRowGroup, TableRow } = Design

  const [, rerender] = React.useReducer((n: number) => n + 1, 0)

  const state = readState()
  const entries = state.entries

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
    { style: { flex: 1 } },
    h(
      View,
      { style: { padding: 16, gap: 12 } },

      h(
        TableRowGroup,
        { title: 'Summary' },
        h(TableRow, {
          label: 'Recorded errors',
          subLabel: `${entries.length} error${entries.length === 1 ? '' : 's'}`,
        }),
        h(TableRow, {
          label: 'Monitoring',
          subLabel: state.enabled ? 'Active' : 'Paused',
        }),
      ),

      h(
        View,
        { style: { flexDirection: 'row', gap: 8 } },
        h(Button, { text: 'Copy all', variant: 'secondary', onPress: copyAll }),
        h(Button, {
          text: 'Clear',
          variant: 'destructive',
          disabled: entries.length === 0,
          onPress: clear,
        }),
      ),

      entries.length === 0
        ? h(Text, { variant: 'text-md/medium', color: 'text-muted' }, 'No errors recorded.')
        : entries.map(entry => h(ErrorCard, { key: entry.id, entry })),
    ),
  )
}