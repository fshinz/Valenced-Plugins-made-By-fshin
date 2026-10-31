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

let logId = 0

const AsyncFunction = Object.getPrototypeOf(
  async function () {},
).constructor as new (
  ...args: string[]
) => (...args: any[]) => Promise<any>

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

  const addHistory = (
    code: string,
    output: string,
    ok: boolean,
  ) => {
    setHistory(prev => [
      {
        id: logId++,
        code,
        result: output,
        ok,
        ts: Date.now(),
      },
      ...prev,
    ].slice(0, MAX_LOG))
  }

  const run = async () => {
    const code = codeRef.current.trim()

    if (!code) return

    try {
      if (!pluginApi) {
        throw new Error('Valenced API is not available.')
      }

      const runtime = (globalThis as any).valenced

      // Execute in an async function so snippets support both
      // top-level return and await.
      //
      // `api` is the plugin API; `valenced` is the unscoped runtime.
      const execute = new AsyncFunction(
        'api',
        'valenced',
        `"use strict";\n${code}\n//# sourceURL=Valenced:PluginDoctor:Sandbox`,
      )

      const pending = execute(pluginApi, runtime)

      const value = awaitResult
        ? await pending
        : pending

      const inspected = nodeUtil.inspect(value, {
        depth: inspectDepth,
        showHidden,
      })

      setResult(inspected)
      setResultOk(true)
      addHistory(code, inspected, true)
    } catch (error) {
      const stack = getErrorStack(error)

      setResult(stack)
      setResultOk(false)
      addHistory(code, stack, false)
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
        onChange: (value: string) => {
          codeRef.current = value
        },
        placeholder:
          'return Object.keys(valenced.discord.flux.Stores)\n\n// Example with await:\nreturn await Promise.resolve("hello")',
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
          trailing: h(
            Text,
            { variant: 'text-sm/normal' },
            String(inspectDepth),
          ),
        }),
      ),

      h(Slider, {
        endIcon: h(
          Text,
          { variant: 'text-sm/normal' },
          '10',
        ),
        maximumValue: 10,
        minimumValue: 0,
        onValueChange: setInspectDepth,
        startIcon: h(
          Text,
          { variant: 'text-sm/normal' },
          '0',
        ),
        step: 1,
        value: inspectDepth,
      }),

      h(
        TableRowGroup,
        { title: 'Display Options' },

        h(TableSwitchRow, {
          label: 'Word wrap',
          subLabel: 'Long results wrap to the next line.',
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

        h(
          Text,
          {
            variant: 'heading-sm/semibold',
            color: resultOk ? 'text-strong' : 'text-danger',
          },
          'Result',
        ),

        h(
          Card,
          null,

          h(
            ScrollView,
            {
              nestedScrollEnabled: true,
              style: { maxHeight: 300 },
            },

            h(
              ScrollView,
              {
                nestedScrollEnabled: true,
                horizontal: !wordWrap,
              },

              h(
                Text,
                {
                  selectable: true,
                  style: { fontFamily: 'monospace' },
                },
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

                label:
                  entry.code.length > 60
                    ? entry.code.slice(0, 60) + '…'
                    : entry.code,

                subLabel:
                  `${new Date(entry.ts).toLocaleTimeString()} · ` +
                  `${entry.ok ? '✓' : '✗'} ` +
                  entry.result.slice(0, 80),

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