import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'

const h = (...args: any[]) => React.createElement(...args)

function getRegistry(): Record<string, any> | null {
  try {
    const g = globalThis as any
    return g.__r?.registry ?? g.__metroModuleRegistry ?? g.modules ?? null
  } catch { return null }
}

function searchModules(query: string, limit = 60) {
  const reg = getRegistry()
  if (!reg) return []

  const lower = query.toLowerCase()
  const results: { id: string; keys: string[]; exports: any }[] = []

  const entries = Array.isArray(reg)
    ? reg.entries()
    : Object.entries(reg)

  for (const [id, mod] of entries) {
    if (results.length >= limit) break
    try {
      const exp = mod?.publicModule?.exports ?? mod?.exports
      if (!exp || typeof exp !== 'object') continue
      const keys = Object.keys(exp)
      if (
        keys.some(k => k.toLowerCase().includes(lower)) ||
        String(id) === query
      ) {
        results.push({ id: String(id), keys, exports: exp })
      }
    } catch { /* */ }
  }

  return results
}

function formatDetail(id: string, exports: any): string {
  try {
    const keys = Object.keys(exports)
    const lines = keys.map(k => ` • ${k}: <${typeof exports[k]}>`)
    return `Module ID: ${id}\nTotal Keys: ${keys.length}\n\nKeys & Types:\n${lines.join('\n')}`
  } catch (e: any) {
    return `Error: ${e.message}`
  }
}

function ModuleCard({
  id,
  keys,
  exports,
  onSelect,
}: {
  id: string
  keys: string[]
  exports: any
  onSelect: () => void
}) {
  const { TouchableOpacity, View } = ReactNative
  const { Text } = Design

  return h(
    TouchableOpacity,
    {
      onPress: onSelect,
      activeOpacity: 0.7,
      style: {
        backgroundColor: '#1e2124',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#2e3035',
      },
    },
    h(
      View,
      { style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 } },
      h(
        Text,
        { variant: 'text-sm/semibold', color: 'text-link' },
        `ID ${id}`,
      ),
      h(
        Text,
        { variant: 'text-xs/medium', color: 'text-muted' },
        `${keys.length} keys`,
      ),
    ),
    h(
      Text,
      { variant: 'text-xs/normal', color: 'text-normal', style: { fontFamily: 'monospace', lineHeight: 18 } },
      keys.slice(0, 8).join(', ') + (keys.length > 8 ? ` … +${keys.length - 8}` : ''),
    ),
  )
}

function DetailView({
  id,
  exports,
  onBack,
}: {
  id: string
  exports: any
  onBack: () => void
}) {
  const { ScrollView, TouchableOpacity, View } = ReactNative
  const { Button, Text } = Design

  const detail = formatDetail(id, exports)
  const [copied, setCopied] = React.useState(false)

  const copy = () => {
    Clipboard.setString(detail)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return h(
    View,
    { style: { flex: 1 } },
    h(
      View,
      {
        style: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#2e3035',
        },
      },
      h(
        TouchableOpacity,
        {
          onPress: onBack,
          style: {
            paddingVertical: 6,
            paddingHorizontal: 10,
            backgroundColor: '#2b2d31',
            borderRadius: 6,
          },
        },
        h(Text, { variant: 'text-sm/semibold', color: 'text-link' }, '← Back'),
      ),
      h(
        Text,
        { variant: 'text-sm/semibold', color: 'text-normal' },
        `Module ${id}`,
      ),
      h(Button, {
        text: copied ? 'Copied!' : 'Copy',
        variant: 'secondary',
        size: 'sm',
        onPress: copy,
      }),
    ),
    h(
      ScrollView,
      { style: { flex: 1, padding: 12 }, keyboardShouldPersistTaps: 'handled' },
      h(
        Text,
        {
          selectable: true,
          variant: 'text-xs/normal',
          style: { fontFamily: 'monospace', lineHeight: 18, color: '#3fb950' },
        },
        detail,
      ),
    ),
  )
}

export function MetroTab() {
  const { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } = ReactNative
  const { Text } = Design

  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<ReturnType<typeof searchModules>>([])
  const [selected, setSelected] = React.useState<{ id: string; exports: any } | null>(null)
  const [searched, setSearched] = React.useState(false)

  const totalModules = React.useMemo(() => {
    const reg = getRegistry()
    if (!reg) return 0
    return Array.isArray(reg) ? reg.length : Object.keys(reg).length
  }, [])

  const search = (q: string) => {
    setQuery(q)
    if (q.length >= 2) {
      setResults(searchModules(q))
      setSearched(true)
    } else {
      setResults([])
      setSearched(false)
    }
  }

  if (selected) {
    return h(DetailView, {
      id: selected.id,
      exports: selected.exports,
      onBack: () => setSelected(null),
    })
  }

  return h(
    KeyboardAvoidingView,
    {
      style: { flex: 1 },
      behavior: Platform.OS === 'ios' ? 'padding' : 'height',
      keyboardVerticalOffset: 120,
    },
    h(
      View,
      { style: { flex: 1 } },

      // Header
      h(
        View,
        {
          style: {
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: '#2e3035',
            gap: 4,
          },
        },
        h(Text, { variant: 'heading-md/semibold', style: { color: '#5865F2' } }, '⚡ Metro Explorer'),
        h(
          Text,
          { variant: 'text-sm/medium', color: 'text-muted' },
          `${totalModules.toLocaleString()} modules loaded`,
        ),
      ),

      // Search
      h(
        View,
        { style: { paddingHorizontal: 16, paddingVertical: 10 } },
        h(TextInput, {
          style: {
            backgroundColor: '#2b2d31',
            color: '#fff',
            padding: 12,
            borderRadius: 10,
            fontSize: 14,
            fontFamily: 'monospace',
          },
          placeholder: 'Search export key or paste module ID…',
          placeholderTextColor: '#666',
          value: query,
          onChangeText: search,
          autoCapitalize: 'none',
          autoCorrect: false,
          spellCheck: false,
          returnKeyType: 'search',
        }),
      ),

      // Results
      h(
        ScrollView,
        { style: { flex: 1, paddingHorizontal: 16 }, keyboardShouldPersistTaps: 'handled' },

        !searched
          ? h(
              Text,
              { variant: 'text-sm/medium', color: 'text-muted', style: { textAlign: 'center', marginTop: 32 } },
              'Type at least 2 characters to search…',
            )
          : results.length === 0
            ? h(
                Text,
                { variant: 'text-sm/medium', color: 'text-muted', style: { textAlign: 'center', marginTop: 32 } },
                'No modules matched.',
              )
            : [
                h(
                  Text,
                  { key: 'count', variant: 'text-xs/semibold', color: 'text-muted', style: { marginBottom: 8 } },
                  `${results.length} result${results.length === 1 ? '' : 's'}`,
                ),
                ...results.map(mod =>
                  h(ModuleCard, {
                    key: mod.id,
                    id: mod.id,
                    keys: mod.keys,
                    exports: mod.exports,
                    onSelect: () => setSelected({ id: mod.id, exports: mod.exports }),
                  }),
                ),
              ],
      ),
    ),
  )
}