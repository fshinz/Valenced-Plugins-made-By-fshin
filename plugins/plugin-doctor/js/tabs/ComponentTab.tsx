import { Page, SearchInput } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'
import { getModuleEntries } from '../registry'

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
  const results: ComponentInfo[] = []
  const lower = filter.toLowerCase()

  for (const [id, exp] of getModuleEntries()) {
    if (results.length >= limit) break
    try {
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

function describeKind(item: ComponentInfo) {
  return item.isMemo ? 'React.memo' : item.isForwardRef ? 'forwardRef' : 'Component'
}

export function ComponentTab() {
  const { ScrollView } = ReactNative
  const { Button, TableRow, TableRowGroup } = Design

  const [filter, setFilter] = React.useState('')
  const [components, setComponents] = React.useState<ComponentInfo[]>([])
  const [scanned, setScanned] = React.useState(false)
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)

  const scan = () => {
    setComponents(scanComponents(filter))
    setScanned(true)
    setExpandedKey(null)
  }

  return h(
    ScrollView,
    { keyboardShouldPersistTaps: 'handled', contentContainerStyle: { paddingBottom: 32 } },
    h(
      Page,
      { spacing: 16 },
      h(SearchInput, {
        value: filter,
        onChange: setFilter,
        placeholder: 'Filter by component name (optional)',
        isClearable: true,
        autoCapitalize: 'none',
        autoCorrect: false,
      }),
      h(Button, { text: 'Scan Metro modules', variant: 'primary', onPress: scan }),
      scanned
        ? h(
            TableRowGroup,
            { title: `Results (${components.length})` },
            components.length === 0
              ? h(TableRow, {
                  label: filter ? `No components matched "${filter}".` : 'No React components found.',
                })
              : components.map(item => {
                  const key = `${item.moduleId}-${item.name}`
                  const expanded = expandedKey === key
                  return h(TableRow, {
                    key,
                    label: item.name,
                    subLabel: expanded
                      ? [
                          `Module: ${item.moduleId}`,
                          describeKind(item),
                          item.propTypes ? `Props: ${item.propTypes.join(', ')}` : null,
                        ]
                          .filter(Boolean)
                          .join('\n')
                      : `#${item.moduleId} · ${describeKind(item)}`,
                    subLabelLineClamp: expanded ? 10 : 1,
                    trailing: expanded ? h(TableRow.TrailingText, { text: 'Copy' }) : null,
                    onPress: () => {
                      if (!expanded) return setExpandedKey(key)
                      Clipboard.setString(
                        `${item.name} (module ${item.moduleId})${item.propTypes ? `\nProps: ${item.propTypes.join(', ')}` : ''}`,
                      )
                      setExpandedKey(null)
                    },
                  })
                }),
          )
        : null,
    ),
  )
}
