import { Design } from '@valenced/discord/design'
import { React, ReactNative } from '@valenced/react'
import { checkAllPlugins, type CompatibilityReport } from '../features/compatibility'

const h = (...args: any[]) => React.createElement(...args)

function ReportRow({ report }: { report: CompatibilityReport }) {
  const { TableRow, TableRowGroup } = Design

  return h(
    TableRowGroup,
    { title: `${report.pluginName}${report.compatible ? ' ✓' : ' ✗'}` },
    report.compatible
      ? h(TableRow, { label: 'No problems found.', subLabel: report.pluginId })
      : report.problems.map(p =>
          h(TableRow, {
            key: `${p.id}-${p.type}`,
            label: p.id,
            subLabel: p.message,
            subLabelLineClamp: 3,
          }),
        ),
  )
}

export function CompatibilityTab() {
  const { ScrollView, View } = ReactNative
  const { Button, TableRow, TableRowGroup, Text } = Design

  const [reports, setReports] = React.useState<CompatibilityReport[]>([])
  const [checking, setChecking] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const run = async () => {
    setChecking(true)
    try {
      setReports(await checkAllPlugins())
    } catch (e) {
      console.error('[PluginDoctor] Compatibility check failed', e)
      setReports([])
    } finally {
      setChecking(false)
      setDone(true)
    }
  }

  const incompatible = reports.filter(r => !r.compatible)
  const compatible = reports.filter(r => r.compatible)

  return h(
    ScrollView,
    { style: { flex: 1 } },
    h(
      View,
      { style: { padding: 16, gap: 12 } },
      h(Text, { variant: 'heading-md/semibold' }, 'API Compatibility Checker'),
      h(
        Text,
        { variant: 'text-sm/medium', color: 'text-muted' },
        'Checks installed plugins for missing or incompatible API dependencies.',
      ),

      h(
        TableRowGroup,
        { title: 'Status' },
        h(TableRow, {
          label: done
            ? `${incompatible.length} incompatible, ${compatible.length} compatible`
            : 'Not yet checked.',
        }),
      ),

      h(Button, {
        text: checking ? 'Checking…' : 'Run check',
        variant: 'primary',
        disabled: checking,
        onPress: run,
      }),

      done && incompatible.length === 0
        ? h(Text, { variant: 'text-md/medium', color: 'text-positive' }, 'All plugins look compatible.')
        : null,

      ...incompatible.map(r => h(ReportRow, { key: r.pluginId, report: r })),

      done && compatible.length > 0
        ? h(
            TableRowGroup,
            { title: 'Compatible plugins' },
            compatible.map(r =>
              h(TableRow, {
                key: r.pluginId,
                label: r.pluginName,
                subLabel: r.pluginId,
              }),
            ),
          )
        : null,
    ),
  )
}
