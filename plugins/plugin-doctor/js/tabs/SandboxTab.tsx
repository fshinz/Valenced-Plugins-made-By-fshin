import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'
import { runSandbox } from '../features/sandbox'

const h = (...args: any[]) => React.createElement(...args)

const EXAMPLES = [
  {
    label: 'List Design keys',
    code: `const { Design } = require('@valenced/discord/design');\nreturn Object.keys(Design).join(', ')`,
  },
  {
    label: 'Find a module by prop',
    code: `const { getModules, withProps } = require('@valenced/modules/finders');\ngetModules(withProps('getChannel'), m => console.log('[Sandbox]', m))`,
  },
  {
    label: 'Read Clipboard',
    code: `const { Clipboard } = require('@valenced/externals/react-native-clipboard');\nreturn await Clipboard.getString()`,
  },
]

export function SandboxTab() {
  const { ScrollView, TextInput, View } = ReactNative
  const { Button, TableRow, TableRowGroup, Text } = Design

  const [code, setCode] = React.useState('')
  const [result, setResult] = React.useState<{ ok: boolean; value?: string; error?: string; duration: number } | null>(null)

  const run = () => {
    const res = runSandbox(code)
    setResult(res)
  }

  const copy = () => {
    if (result?.value) Clipboard.setString(result.value)
    else if (result?.error) Clipboard.setString(result.error)
  }

  return h(
    ScrollView,
    { style: { flex: 1, padding: 16 } },
    h(
      View,
      { style: { gap: 12 } },
      h(Text, { variant: 'heading-md/semibold' }, 'Plugin Sandbox'),
      h(
        Text,
        { variant: 'text-sm/medium', color: 'text-muted' },
        'Run small JS snippets against Valenced APIs without rebuilding.',
      ),

      h(
        TableRowGroup,
        { title: 'Examples' },
        EXAMPLES.map(ex =>
          h(TableRow, {
            key: ex.label,
            label: ex.label,
            onPress: () => setCode(ex.code),
          }),
        ),
      ),

      h(TextInput, {
        style: {
          borderWidth: 1,
          borderColor: '#555',
          borderRadius: 8,
          padding: 10,
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 13,
          minHeight: 120,
          textAlignVertical: 'top',
        },
        multiline: true,
        placeholder: '// JS snippet\nreturn 1 + 1',
        placeholderTextColor: '#888',
        value: code,
        onChangeText: setCode,
      }),

      h(
        View,
        { style: { flexDirection: 'row', gap: 8 } },
        h(Button, { text: 'Run', variant: 'primary', onPress: run }),
        h(Button, {
          text: 'Clear',
          variant: 'secondary',
          onPress: () => { setCode(''); setResult(null) },
        }),
      ),

      result
        ? h(
            View,
            { style: { gap: 8 } },
            h(
              View,
              { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
              h(
                Text,
                { variant: 'text-sm/semibold', color: result.ok ? 'text-positive' : 'text-danger' },
                result.ok ? `✓ OK (${result.duration}ms)` : `✗ Error (${result.duration}ms)`,
              ),
              h(Button, { text: 'Copy', variant: 'secondary', size: 'sm', onPress: copy }),
            ),
            h(TextInput, {
              style: {
                borderWidth: 1,
                borderColor: result.ok ? '#3a3' : '#a33',
                borderRadius: 8,
                padding: 10,
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: 12,
                minHeight: 80,
                textAlignVertical: 'top',
              },
              multiline: true,
              editable: false,
              value: result.ok ? (result.value ?? '') : (result.error ?? ''),
            }),
          )
        : null,
    ),
  )
}
