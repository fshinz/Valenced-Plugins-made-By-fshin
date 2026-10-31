import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'

const h = (...args: any[]) => React.createElement(...args)

type ComponentInfo = {
  name: string
  moduleId: string
  propTypes?: string[]
  isForwardRef: boolean
  isMemo: boolean
}

function looksLikeComponent(val: unknown): boolean {
  if (!val || (typeof val !== 'function' && typeof val !== 'object')) return false
  if (typeof val === 'function') {
    const name = (val as any).name ?? ''
    // Discord component names are PascalCase or start with upper letter
    if (!name || name[0] !== name[0].toUpperCase() || name[0] === name[0].toLowerCase()) return false
    return true
  }
  // memo / forwardRef wrapper
  const t = (val as any).$$typeof
  if (t) {
    const s = String(t)
    if (s.includes('memo') || s.includes('forward')) return true
  }
  return false
}

function scanComponents(filter: string, limit = 150): ComponentInfo[] {
  const g = globalThis as any
  const registry: Record<string, any> =
    g.__r?.registry ?? g.__metroModuleRegistry ?? g.modules ?? {}

  const results: ComponentInfo[] = []
  const lower = filter.toLowerCase()

  const entries: [string, any][] = Array.isArray(registry)
    ? (registry as any[]).map((v, i) => [String(i), v])
    : Object.entries(registry)

  for (const [id, mod] of entries) {
    if (results.length >= limit) break
    try {
      const exp = mod?.publicModule?.exports ?? mod?.exports
      if (!exp || typeof exp !== 'object') continue

      for (const key of Object.keys(exp)) {
        if (results.length >= limit) break
        if (filter && !key.toLowerCase().includes(lower)) continue

        const val = exp[key]
        if (!looksLikeComponent(val)) continue

        const isMemo = !!(val as any).$$typeof && String((val as any).$$typeof).includes('memo')
        const isForwardRef = !!(val as any).$$typeof && String((val as any).$$typeof).includes('forward')
        const inner = isMemo ? (val as any).type : isForwardRef ? (val as any).render : val
        const propKeys = inner?.propTypes ? Object.keys(inner.propTypes) : []

        results.push({
          name: key,
          moduleId: id,
          propTypes: propKeys.length > 0 ? propKeys : undefined,
          isMemo,
          isForwardRef,
        })
      }
    } catch { /* */ }
  }

  return results
}

export function ComponentTab() {
  const { ScrollView, TextInput, View } = ReactNative
  const { Button, TableRow, TableRowGroup, Text } = Design

  const [filter, setFilter] = React.useState('')
  const [components, setComponents] = React.useState<ComponentInfo[]>([])
  const [scanned, setScanned] = React.useState(false)
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null)

  const scan = () => {
    setComponents(scanComponents(filter))
    setScanned(true)
    setExpandedIdx(null)
  }

  return h(
    ScrollView,
    { style: { flex: 1 }, keyboardShouldPersistTaps: 'handled' },
    h(
      View,
      { style: { padding: 16, gap: 16 } },

      h(
        TableRowGroup,
        { title: 'Component Inspector' },
        h(TextInput, {
          style: { padding: 10, color: '#fff', fontSize: 13 },
          placeholder: 'Filter by component name (optional)',
          placeholderTextColor: '#666',
          value: filter,
          onChangeText: setFilter,
          autoCapitalize: 'none',
          autoCorrect: false,
          returnKeyType: 'search',
          onSubmitEditing: scan,
        }),
        h(TableRow, {
          label: 'Scan Metro modules',
          subLabel: scanned ? `${components.length} component${components.length === 1 ? '' : 's'} found` : 'Finds exported React components in the Metro registry.',
          onPress: scan,
        }),
      ),

      scanned && components.length === 0
        ? h(
            TableRowGroup,
            { title: 'No results' },
            h(TableRow, {
              label: filter ? `No components matched "${filter}".` : 'No React components found in Metro registry.',
            }),
          )
        : null,

      scanned && components.length > 0
        ? h(
            TableRowGroup,
            { title: `Results (${components.length})` },
            components.map((item, i) =>
              h(TableRow, {
                key: `${item.moduleId}-${item.name}`,
                label: item.name,
                subLabel: expandedIdx === i
                  ? [
                      `Module: ${item.moduleId}`,
                      item.isMemo ? 'React.memo' : item.isForwardRef ? 'forwardRef' : 'Component',
                      item.propTypes ? `Props: ${item.propTypes.join(', ')}` : null,
                    ].filter(Boolean).join('\n')
                  : [
                      `#${item.moduleId}`,
                      item.isMemo ? 'memo' : item.isForwardRef ? 'forwardRef' : null,
                    ].filter(Boolean).join(' · '),
                subLabelLineClamp: expandedIdx === i ? 10 : 1,
                onPress: () => setExpandedIdx(expandedIdx === i ? null : i),
                trailing: expandedIdx === i
                  ? h(Text, {
                      variant: 'text-sm/medium',
                      color: 'text-link',
                      onPress: (e: any) => {
                        e?.stopPropagation?.()
                        Clipboard.setString(`${item.name} (module ${item.moduleId})${item.propTypes ? '\nProps: ' + item.propTypes.join(', ') : ''}`)
                      },
                    }, 'Copy')
                  : null,
              }),
            ),
          )
        : null,
    ),
  )
}