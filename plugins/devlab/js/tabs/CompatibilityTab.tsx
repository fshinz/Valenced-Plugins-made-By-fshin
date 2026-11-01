import { Page } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { React, ReactNative } from '@valenced/react'
import { checkAllPlugins, type CompatibilityReport } from '../features/compatibility'
import { recordError } from '../storage'

const h = (...args: any[]) => React.createElement(...args)

function ReportGroup({ report }: { report: CompatibilityReport }) {
  const { TableRow, TableRowGroup } = Design

  return h(
    TableRowGroup,
    { title: report.pluginName, description: report.pluginId },
    report.problems.map(problem =>
      h(TableRow, {
        key: `${problem.id}-${problem.type}`,
        label: problem.id,
        subLabel: problem.message,
        subLabelLineClamp: 3,
      }),
    ),
  )
}

export function CompatibilityTab() {
  const { ScrollView } = ReactNative
  const { Button, TableRow, TableRowGroup } = Design

  const [reports, setReports] = React.useState<CompatibilityReport[]>([])
  const [checking, setChecking] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const run = async () => {
    setChecking(true)
    try {
      setReports(await checkAllPlugins())
    } catch (error) {
      setReports([])
      recordError(error, 'Compatibility check failed')
    } finally {
      setChecking(false)
      setDone(true)
    }
  }

  const incompatible = reports.filter(r => !r.compatible)
  const compatible = reports.filter(r => r.compatible)

  return h(
    ScrollView,
    { contentContainerStyle: { paddingBottom: 32 } },
    h(
      Page,
      { spacing: 16 },
      h(
        TableRowGroup,
        { title: 'API Compatibility Checker', description: 'Checks installed plugins for missing or incompatible API dependencies.' },
        h(TableRow, {
          label: 'Status',
          trailing: h(TableRow.TrailingText, {
            text: done ? `${incompatible.length} incompatible, ${compatible.length} compatible` : 'Not checked',
          }),
        }),
      ),
      h(Button, { text: checking ? 'Checking…' : 'Run check', variant: 'primary', loading: checking, disabled: checking, onPress: run }),
      incompatible.map(report => h(ReportGroup, { key: report.pluginId, report })),
      done && compatible.length > 0
        ? h(
            TableRowGroup,
            { title: 'Compatible plugins' },
            compatible.map(report =>
              h(TableRow, { key: report.pluginId, label: report.pluginName, subLabel: report.pluginId }),
            ),
          )
        : null,
    ),
  )
}
