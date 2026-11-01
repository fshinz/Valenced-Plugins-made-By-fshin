import { Page } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { nodeUtil } from '@valenced/externals/browserify'
import { getErrorStack } from '@valenced/utils/error'
import { React, ReactNative } from '@valenced/react'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { pluginApi } from '../api'

const h = (...args: any[]) => React.createElement(...args)
const { Button, Card, Stack, TableRow, TableRowGroup, TableSwitchRow, Text, TextArea } = Design
const MAX_HISTORY = 30

type HistoryEntry = { id: number; code: string; result: string; ok: boolean; ts: number }
let historyId = 0
let sharedHistory: HistoryEntry[] = []
const historyListeners = new Set<(entries: HistoryEntry[]) => void>()
function publishHistory(entry: HistoryEntry) {
  sharedHistory = [entry, ...sharedHistory].slice(0, MAX_HISTORY)
  for (const listener of [...historyListeners]) { try { listener(sharedHistory) } catch { /* */ } }
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (...args: string[]) => (...args: any[]) => Promise<any>

const QUICK_ACTIONS = [
  { label: 'List Flux stores', code: 'return Object.keys(valenced?.discord?.flux?.Stores ?? {}).sort()' },
  { label: 'Selected channel ID', code: 'return valenced?.discord?.flux?.Stores?.SelectedChannelStore?.getChannelId?.() ?? null' },
  { label: 'Selected guild ID', code: 'return valenced?.discord?.flux?.Stores?.SelectedGuildStore?.getGuildId?.() ?? null' },
  { label: 'Plugin API keys', code: 'return Object.keys(api ?? {}).sort()' },
]

export function SandboxTab() {
  const { ScrollView } = ReactNative
  const codeRef = React.useRef('')
  const [code, setCode] = React.useState('')
  const [result, setResult] = React.useState('')
  const [resultOk, setResultOk] = React.useState(true)
  const [wordWrap, setWordWrap] = React.useState(true)
  const [running, setRunning] = React.useState(false)
  const [history, setHistory] = React.useState<HistoryEntry[]>(() => sharedHistory)

  React.useEffect(() => {
    const listener = (entries: HistoryEntry[]) => setHistory(entries)
    historyListeners.add(listener)
    setHistory(sharedHistory)
    return () => { historyListeners.delete(listener) }
  }, [])
  const addHistory = (code: string, output: string, ok: boolean) => publishHistory({ id: historyId++, code, result: output, ok, ts: Date.now() })

  const run = async (override?: string) => {
    const code = (override ?? codeRef.current).trim()
    if (!code || running) return
    codeRef.current = code
    setRunning(true)
    try {
      if (!pluginApi) throw new Error('DevLab plugin API is not available. Try reloading the plugin.')
      const runtime = (globalThis as any).valenced
      const execute = new AsyncFunction('api', 'valenced', `"use strict";\n${code}\n//# sourceURL=Valenced:DevLab:Sandbox`)w
      const value = await execute(pluginApi, runtime)
      const inspected = value === undefined ? 'undefined' : nodeUtil.inspect(value, { depth: 4, showHidden: false, maxArrayLength: 100, maxStringLength: 10000 })
      setResult(inspected)
      setResultOk(true)
      addHistory(code, inspected, true)
    } catch (error) {
      const stack = getErrorStack(error)
      setResult(stack)
      setResultOk(false)
      addHistory(code, stack, false)
    } finally { setRunning(false) }
  }

  return h(ScrollView, { keyboardShouldPersistTaps: 'handled', contentContainerStyle: { paddingBottom: 32 } },
    h(Page, { spacing: 16 },
      h(TextArea, {
        autoFocus: false,
        label: 'JavaScript',
        value: code,
        onChange: (value: string) => { codeRef.current = value; setCode(value) },
        placeholder: 'return Object.keys(valenced.discord.flux.Stores)\n\n// Async works automatically:\nreturn await Promise.resolve("hello")',
        size: 'md',
      }),
      h(TableRowGroup, { title: 'Quick actions' },
        QUICK_ACTIONS.map(action => h(TableRow, { key: action.label, label: action.label, trailing: h(TableRow.TrailingText, { text: 'Load' }), onPress: () => { codeRef.current = action.code; setCode(action.code); setResult(`Loaded: ${action.label}\nPress Run to execute.`) } })),
      ),
      h(Stack, { direction: 'horizontal', spacing: 8 },
        h(Button, { text: running ? 'Running…' : 'Run', variant: 'primary', grow: true, disabled: running, onPress: () => run() }),
        h(Button, { text: 'Clear', variant: 'secondary', onPress: () => { codeRef.current = ''; setCode(''); setResult(''); setResultOk(true) } }),
      ),
      h(TableRowGroup, { title: 'Output options' },
        h(TableSwitchRow, { label: 'Word wrap', subLabel: 'Wrap long output lines.', value: wordWrap, onValueChange: setWordWrap }),
      ),
      h(Stack, { spacing: 8 },
        h(Text, { variant: 'heading-sm/semibold', color: resultOk ? 'text-strong' : 'text-danger' }, resultOk ? 'Result' : 'Error'),
        h(Card, null,
          h(ScrollView, { nestedScrollEnabled: true, style: { maxHeight: 320 } },
            h(ScrollView, { nestedScrollEnabled: true, horizontal: !wordWrap },
              h(Text, { selectable: true, style: { fontFamily: 'monospace' } }, result || 'Run code to see its output.'),
            ),
          ),
        ),
        result ? h(Button, { text: 'Copy result', variant: 'secondary', onPress: () => Clipboard.setString(result) }) : null,
      ),
      h(TableRowGroup, { title: `History (${history.length}/${MAX_HISTORY})` },
        history.length === 0
          ? h(TableRow, { label: 'No runs yet.', subLabel: 'Recent results stay available when you navigate away from DevLab.' })
          : history.map(entry => h(TableRow, {
              key: entry.id,
              label: entry.code.length > 64 ? `${entry.code.slice(0, 64)}…` : entry.code,
              subLabel: `${new Date(entry.ts).toLocaleTimeString()} · ${entry.ok ? 'Success' : 'Error'} · ${entry.result.slice(0, 90)}`,
              subLabelLineClamp: 2,
              onPress: () => { codeRef.current = entry.code; setCode(entry.code); setResult(entry.result); setResultOk(entry.ok) },
            })),
      ),
      history.length > 0 ? h(Button, { text: 'Clear history', variant: 'destructive', onPress: () => { sharedHistory = []; setHistory([]); for (const listener of [...historyListeners]) listener(sharedHistory) } }) : null,
    ),
  )
}
