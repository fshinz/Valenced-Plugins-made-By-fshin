import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'
import { clearErrors, readState } from './storage'

const h = (...args: any[]) => React.createElement(...args)

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function copyDiagnostics() {
  const state = readState()

  const text = state.entries
    .map(entry => {
      return [
        `[${formatTime(entry.timestamp)}] ${entry.title}`,
        entry.message,
        entry.context ? `Context: ${entry.context}` : '',
        entry.stack ?? '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  Clipboard.setString(text || 'Plugin Doctor has no diagnostics.')
}

function ErrorRow({ entry }: { entry: ReturnType<typeof readState>['entries'][number] }) {
  const { TableRow } = Design

  return h(TableRow, {
    label: entry.title,
    subLabel: `${formatTime(entry.timestamp)}\n${entry.message}`,
    subLabelLineClamp: 6,
    arrow: false,
  })
}

export function PluginDoctorSettings() {
  const { ScrollView, View } = ReactNative
  const { Button, Stack, TableRow, TableRowGroup, Text } = Design
  const [, rerender] = React.useReducer((value: number) => value + 1, 0)
  const state = readState()

  const clear = async () => {
    await clearErrors()
    rerender()
  }

  const entries = state.entries

  return h(
    ScrollView,
    { style: { flex: 1 } },
    h(
      Stack,
      { spacing: 16, style: { padding: 16 } },
      h(
        View,
        null,
        h(Text, { variant: 'heading-lg/semibold' }, 'Plugin Doctor'),
        h(
          Text,
          { variant: 'text-sm/medium', color: 'text-muted' },
          'Diagnostics for Valenced plugin developers.',
        ),
      ),
      h(
        TableRowGroup,
        { title: 'Diagnostics' },
        h(TableRow, {
          label: 'Recorded problems',
          subLabel: `${entries.length} diagnostic${entries.length === 1 ? '' : 's'}`,
        }),
        h(TableRow, {
          label: 'Client status',
          subLabel: 'Plugin Doctor is running',
        }),
      ),
      h(
        View,
        { style: { flexDirection: 'row', gap: 8 } },
        h(Button, {
          text: 'Copy diagnostics',
          variant: 'secondary',
          onPress: copyDiagnostics,
        }),
        h(Button, {
          text: 'Clear',
          variant: 'destructive',
          disabled: entries.length === 0,
          onPress: clear,
        }),
      ),
      entries.length
        ? h(
            TableRowGroup,
            { title: 'Recent errors' },
            ...entries.map(entry => h(ErrorRow, { key: entry.id, entry })),
          )
        : h(
            Text,
            { variant: 'text-md/medium', color: 'text-muted' },
            'No errors have been recorded.',
          ),
    ),
  )
}
