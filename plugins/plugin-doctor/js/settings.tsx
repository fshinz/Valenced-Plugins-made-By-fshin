import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'
import {
  checkAllPlugins,
  type CompatibilityReport,
} from './features/compatibility'
import {
  clearErrors,
  readState,
  type DiagnosticEntry,
} from './storage'

const h = (...args: any[]) => React.createElement(...args)

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString()
}

function copyDiagnostics() {
  const state = readState()

  const errorText = state.entries
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

  const compatibilityText = compatibilityReports
    .filter(report => !report.compatible)
    .map(report => {
      const problems = report.problems
        .map(problem => `- ${problem.message}`)
        .join('\n')

      return `${report.pluginName} (${report.pluginId})\n${problems}`
    })
    .join('\n\n')

  const text = [
    'PLUGIN DOCTOR DIAGNOSTICS',
    `Generated: ${new Date().toISOString()}`,
    '',
    errorText ? `ERRORS\n${errorText}` : 'ERRORS\nNo recorded errors.',
    '',
    compatibilityText
      ? `COMPATIBILITY PROBLEMS\n${compatibilityText}`
      : 'COMPATIBILITY PROBLEMS\nNo compatibility problems found.',
  ].join('\n')

  Clipboard.setString(text)
}

let compatibilityReports: CompatibilityReport[] = []

function ErrorRow({ entry }: { entry: DiagnosticEntry }) {
  const { TableRow } = Design

  return h(TableRow, {
    label: entry.title,
    subLabel: `${formatTime(entry.timestamp)}\n${entry.message}`,
    subLabelLineClamp: 6,
  })
}

function CompatibilityRow({
  report,
}: {
  report: CompatibilityReport
}) {
  const { TableRow, TableRowGroup } = Design

  return h(
    TableRowGroup,
    { title: report.pluginName },
    ...report.problems.map(problem =>
      h(TableRow, {
        key: `${report.pluginId}:${problem.id}:${problem.type}`,
        label: problem.id,
        subLabel: problem.message,
        subLabelLineClamp: 3,
      }),
    ),
  )
}

export function PluginDoctorSettings() {
  const { ScrollView, View } = ReactNative
  const { Button, Stack, TableRow, TableRowGroup, Text } = Design

  const [, rerender] = React.useReducer((value: number) => value + 1, 0)
  const [checking, setChecking] = React.useState(false)
  const [reports, setReports] = React.useState<CompatibilityReport[]>([])
  const [hasChecked, setHasChecked] = React.useState(false)

  const state = readState()
  const entries = state.entries
  const incompatibleReports = reports.filter(report => !report.compatible)

  const clear = async () => {
    await clearErrors()
    rerender()
  }

  const runCompatibilityCheck = async () => {
    setChecking(true)

    try {
      const nextReports = await checkAllPlugins()
      compatibilityReports = nextReports
      setReports(nextReports)
      setHasChecked(true)
    } catch (error) {
      compatibilityReports = []
      setReports([])
      setHasChecked(true)
      console.error('Plugin Doctor compatibility check failed', error)
    } finally {
      setChecking(false)
    }
  }

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
          'Diagnostics and compatibility tools for Valenced plugin developers.',
        ),
      ),

      h(
        TableRowGroup,
        { title: 'Diagnostics' },
        h(TableRow, {
          label: 'Recorded errors',
          subLabel: `${entries.length} error${entries.length === 1 ? '' : 's'}`,
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
          text: 'Clear errors',
          variant: 'destructive',
          disabled: entries.length === 0,
          onPress: clear,
        }),
      ),

      entries.length
        ? h(
            TableRowGroup,
            { title: 'Recent errors' },
            ...entries.map(entry =>
              h(ErrorRow, {
                key: entry.id,
                entry,
              }),
            ),
          )
        : h(
            Text,
            { variant: 'text-md/medium', color: 'text-muted' },
            'No errors have been recorded.',
          ),

      h(
        TableRowGroup,
        { title: 'API compatibility' },
        h(TableRow, {
          label: 'Compatibility status',
          subLabel: !hasChecked
            ? 'No compatibility check has been run.'
            : incompatibleReports.length === 0
              ? `All ${reports.length} installed plugin${reports.length === 1 ? '' : 's'} look compatible.`
              : `${incompatibleReports.length} incompatible plugin${incompatibleReports.length === 1 ? '' : 's'} found.`,
        }),
        h(Button, {
          text: checking ? 'Checking...' : 'Run compatibility check',
          variant: 'secondary',
          disabled: checking,
          onPress: runCompatibilityCheck,
        }),
      ),

      hasChecked && incompatibleReports.length === 0
        ? h(
            Text,
            { variant: 'text-md/medium', color: 'text-muted' },
            'No required dependency problems were found.',
          )
        : null,

      ...incompatibleReports.map(report =>
        h(CompatibilityRow, {
          key: report.pluginId,
          report,
        }),
      ),
    ),
  )
}
