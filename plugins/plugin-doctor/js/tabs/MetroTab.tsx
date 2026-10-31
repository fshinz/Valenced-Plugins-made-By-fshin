import { Design } from '@valenced/discord/design'
import { React, ReactNative } from '@valenced/react'
import { inspectModule, searchModules, type MetroModule } from '../features/metro'

const h = (...args: any[]) => React.createElement(...args)

function ModuleRow({ mod, onSelect }: { mod: MetroModule; onSelect: () => void }) {
  const { TableRow } = Design
  return h(TableRow, {
    label: `Module #${mod.id}`,
    subLabel: mod.matchedKeys.join(', '),
    subLabelLineClamp: 2,
    onPress: onSelect,
  })
}

function ModuleDetail({ mod, onBack }: { mod: MetroModule; onBack: () => void }) {
  const { ScrollView, View } = ReactNative
  const { Button, TableRow, TableRowGroup, Text } = Design

  const detail = inspectModule(mod.id) ?? {}

  return h(
    ScrollView,
    { style: { flex: 1 } },
    h(
      View,
      { style: { padding: 16, gap: 12 } },
      h(Button, { text: '← Back', variant: 'secondary', onPress: onBack }),
      h(Text, { variant: 'heading-md/semibold' }, `Module #${mod.id}`),
      h(
        TableRowGroup,
        { title: 'Exported keys' },
        Object.entries(detail).map(([key, type]) =>
          h(TableRow, { key, label: key, subLabel: type }),
        ),
      ),
    ),
  )
}

export function MetroTab() {
  const { ScrollView, TextInput, View } = ReactNative
  const { Button, TableRowGroup, Text } = Design

  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<MetroModule[]>([])
  const [selected, setSelected] = React.useState<MetroModule | null>(null)
  const [searched, setSearched] = React.useState(false)

  const search = () => {
    setResults(searchModules(query.trim()))
    setSearched(true)
  }

  if (selected) {
    return h(ModuleDetail, { mod: selected, onBack: () => setSelected(null) })
  }

  return h(
    ScrollView,
    { style: { flex: 1 } },
    h(
      View,
      { style: { padding: 16, gap: 12 } },
      h(Text, { variant: 'heading-md/semibold' }, 'Metro Inspector'),
      h(Text, { variant: 'text-sm/medium', color: 'text-muted' }, 'Search available Metro module exports by key name.'),

      h(
        View,
        { style: { flexDirection: 'row', gap: 8, alignItems: 'center' } },
        h(TextInput, {
          style: {
            flex: 1,
            borderWidth: 1,
            borderColor: '#555',
            borderRadius: 8,
            padding: 8,
            color: '#fff',
          },
          placeholder: 'e.g. ChannelStore',
          placeholderTextColor: '#888',
          value: query,
          onChangeText: setQuery,
          onSubmitEditing: search,
          returnKeyType: 'search',
        }),
        h(Button, { text: 'Search', variant: 'primary', onPress: search }),
      ),

      searched && results.length === 0
        ? h(Text, { variant: 'text-md/medium', color: 'text-muted' }, 'No modules matched.')
        : null,

      results.length > 0
        ? h(
            TableRowGroup,
            { title: `Results (${results.length})` },
            results.map(mod =>
              h(ModuleRow, { key: mod.id, mod, onSelect: () => setSelected(mod) }),
            ),
          )
        : null,
    ),
  )
}
