import { Page } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { nodeUtil } from '@valenced/externals/browserify'
import { getErrorStack } from '@valenced/utils/error'
import { React, ReactNative } from '@valenced/react'
import { pluginApi } from '../api'

const h = (...args: any[]) => React.createElement(...args)

const {
  Button,
  Card,
  Slider,
  Stack,
  TableRow,
  TableRowGroup,
  TableSwitchRow,
  Text,
  TextArea,
} = Design

const MAX_LOG = 30

type LogEntry = {
  id: number
  code: string
  result: string
  ok: boolean
  ts: number
}

let _logId = 0

export function SandboxTab() {
  const { ScrollView } = ReactNative

  const codeRef = React.useRef('')
  const [result, setResult] = React.useState('')
  const [resultOk, setResultOk] = React.useState(true)
  const [awaitResult, setAwaitResult] = React.useState(true)
  const [showHidden, setShowHidden] = React.useState(true)
  const [inspectDepth, setInspectDepth] = React.useState(3)
  const [wordWrap, setWordWrap] = React.useState(true)
  const [history, setHistory] = React.useState<LogEntry[]>([])

  const run = async () => {
    const code = codeRef.current.trim()
    if (!code) return

    const key = `_pd_${Math.random().toString(36).slice(2)}`

    try {
      if (!pluginApi) {
        setResult('<Valenced API not available>')
        setResultOk(false)
        return
      }

      ;(globalThis as any)[key] = pluginApi

      // Same pattern as the built-in EvalJS: indirect eval with api injected.
      // `valenced` is the unscoped API — valenced.discord.design, valenced.modules.finders, etc.
      // eslint-disable-next-line no-eval
      const res = (0, eval)(
        `var api=${key},{unscoped:valenced}=api;undefined;${code}//# sourceURL=Valenced:PluginDoctor:Sandbox`,
      )

      const inspected = nodeUtil.inspect(awaitResult ? await res : res, {
        depth: inspectDepth,
        showHidden,
      })

      setResult(inspected)
      setResultOk(true)

      setHistory(prev => [
        { id: _logId++, code, result: inspected, ok: true, ts: Date.now() },
        ...prev,
      ].slice(0, MAX_LOG))
    } catch (e) {
      const stack = getErrorStack(e)
      setResult(stack)
      setResultOk(false)

      setHistory(prev => [
        { id: _logId++, code, result: stack, ok: false, ts: Date.now() },
        ...prev,
      ].slice(0, MAX_LOG))
    } finally {
      delete (globalThis as any)[key]
    }
  }

  return h(
    ScrollView,
    { contentContainerStyle: { paddingBottom: 32 } },
    h(
      Page,
      { spacing: 16 },

      h(TextArea, {
        autoFocus: false,
        label: 'Code',
        onChange: (v: string) => { codeRef.current = v },
        placeholder: 'valenced.discord.design.Design.Text\n// or:\nvar gs = valenced.discord.flux.Stores.GuildStore\nreturn gs.getGuilds()',
        size: 'md',
      }),

      h(
        TableRowGroup,
        { title: 'Inspection Options' },
        h(TableSwitchRow, {
          label: 'Await result',
          subLabel: 'Wait for the result before displaying.',
          value: awaitResult,
          onValueChange: setAwaitResult,
        }),
        h(TableSwitchRow, {
          label: 'Show hidden',
          subLabel: 'Show hidden/non-enumerable properties.',
          value: showHidden,
          onValueChange: setShowHidden,
        }),
        h(TableRow, {
          label: 'Inspect depth',
          subLabel: 'Depth for nested object inspection.',
          trailing: h(Text, { variant: 'text-sm/normal' }, String(inspectDepth)),
        }),
      ),

      h(Slider, {
        endIcon: h(Text, { variant: 'text-sm/normal' }, '10'),
        maximumValue: 10,
        minimumValue: 0,
        onValueChange: setInspectDepth,
        startIcon: h(Text, { variant: 'text-sm/normal' }, '0'),
        step: 1,
        value: inspectDepth,
      }),

      h(
        TableRowGroup,
        { title: 'Display Options' },
        h(TableSwitchRow, {
          label: 'Word wrap',
          subLabel: 'Long results wrap to next line.',
          value: wordWrap,
          onValueChange: setWordWrap,
        }),
      ),

      h(Button, {
        text: 'Evaluate',
        variant: 'primary',
        onPress: run,
      }),

      h(
        Stack,
        null,
        h(Text, { variant: 'heading-sm/semibold', color: resultOk ? 'text-strong' : 'text-danger' }, 'Result'),
        h(
          Card,
          null,
          h(
            ScrollView,
            { nestedScrollEnabled: true, style: { maxHeight: 300 } },
            h(
              ScrollView,
              { nestedScrollEnabled: true, horizontal: !wordWrap },
              h(
                Text,
                { selectable: true, style: { fontFamily: 'monospace' } },
                result || '<empty>',
              ),
            ),
          ),
        ),
      ),

      history.length > 0
        ? h(
            TableRowGroup,
            { title: 'History' },
            history.map(entry =>
              h(TableRow, {
                key: entry.id,
                label: entry.code.length > 60 ? entry.code.slice(0, 60) + '…' : entry.code,
                subLabel: `${new Date(entry.ts).toLocaleTimeString()} · ${entry.ok ? '✓' : '✗'} ${entry.result.slice(0, 80)}`,
                subLabelLineClamp: 2,
                onPress: () => {
                  codeRef.current = entry.code
                  setResult(entry.result)
                  setResultOk(entry.ok)
                },
              }),
            ),
          )
        : null,
    ),
  )
}