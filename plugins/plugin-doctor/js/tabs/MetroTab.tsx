import { Page, SearchInput } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'
import { getModuleEntries } from '../registry'

const h = (...args: any[]) => React.createElement(...args)

const MAX_RESULTS = 60
const PREVIEW_KEYS = 6

type ModuleMatch = { id: string; keys: string[]; exports: any }

function searchModules(query: string): ModuleMatch[] {
  const lower = query.toLowerCase()
  const results: ModuleMatch[] = []

  for (const [id, exports] of getModuleEntries()) {
    if (results.length >= MAX_RESULTS) break
    if (!exports || typeof exports !== 'object') continue
    try {
      const keys = Object.keys(exports)
      if (id === query || keys.some(k => k.toLowerCase().includes(lower))) {
        results.push({ id, keys, exports })
      }
    } catch { /* exotic exports can throw on key access; skip them */ }
  }

  return results
}

function formatDetail({ id, keys, exports }: ModuleMatch): string {
  const lines = keys.map(key => {
    try {
      return ` • ${key}: <${typeof exports[key]}>`
    } catch {
      return ` • ${key}: <unreadable>`
    }
  })
  return `Module ID: ${id}\nTotal Keys: ${keys.length}\n\nKeys & Types:\n${lines.join('\n')}`
}

function ModuleDetail({ module, onBack }: { module: ModuleMatch; onBack: () => void }) {
  const { ScrollView } = ReactNative
  const { Button, Card, Stack, Text } = Design
  const [copied, setCopied] = React.useState(false)

  const detail = React.useMemo(() => formatDetail(module), [module])

  const copy = () => {
    Clipboard.setString(detail)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return h(
    ScrollView,
    { contentContainerStyle: { paddingBottom: 32 } },
    h(
      Page,
      { spacing: 16 },
      h(
        Stack,
        { direction: 'horizontal', spacing: 8 },
        h(Button, { text: 'Back', variant: 'secondary', grow: true, onPress: onBack }),
        h(Button, { text: copied ? 'Copied' : 'Copy', variant: 'primary', grow: true, onPress: copy }),
      ),
      h(
        Card,
        null,
        h(Text, { selectable: true, variant: 'text-sm/normal', style: { fontFamily: 'monospace' } }, detail),
      ),
    ),
  )
}

export function MetroTab() {
  const { ScrollView } = ReactNative
  const { TableRow, TableRowGroup } = Design

  const [query, setQuery] = React.useState('')
  const [selected, setSelected] = React.useState<ModuleMatch | null>(null)

  const totalModules = React.useMemo(() => getModuleEntries().length, [])
  const results = React.useMemo(() => (query.length >= 2 ? searchModules(query) : []), [query])

  if (selected) {
    return h(ModuleDetail, { module: selected, onBack: () => setSelected(null) })
  }

  return h(
    ScrollView,
    { keyboardShouldPersistTaps: 'handled', contentContainerStyle: { paddingBottom: 32 } },
    h(
      Page,
      { spacing: 16 },
      h(
        TableRowGroup,
        { title: 'Metro Explorer' },
        h(TableRow, {
          label: 'Initialized modules',
          trailing: h(TableRow.TrailingText, { text: totalModules.toLocaleString() }),
        }),
      ),
      h(SearchInput, {
        value: query,
        onChange: setQuery,
        placeholder: 'Search export key or paste module ID',
        isClearable: true,
        autoCapitalize: 'none',
        autoCorrect: false,
      }),
      h(
        TableRowGroup,
        { title: query.length >= 2 ? `Results (${results.length})` : 'Results' },
        query.length < 2
          ? h(TableRow, { label: 'Type at least 2 characters to search.' })
          : results.length === 0
            ? h(TableRow, { label: 'No modules matched.' })
            : results.map(match =>
                h(TableRow, {
                  key: match.id,
                  label: `ID ${match.id}`,
                  subLabel:
                    match.keys.slice(0, PREVIEW_KEYS).join(', ') +
                    (match.keys.length > PREVIEW_KEYS ? ` … +${match.keys.length - PREVIEW_KEYS}` : ''),
                  subLabelLineClamp: 3,
                  trailing: h(TableRow.TrailingText, { text: `${match.keys.length} keys` }),
                  arrow: true,
                  onPress: () => setSelected(match),
                }),
              ),
      ),
    ),
  )
}
