import { Design } from '@valenced/discord/design'
import { React, ReactNative } from '@valenced/react'

const h = (...args: any[]) => React.createElement(...args)

// Walk a React fiber tree to find components matching a name.
function findFibersByName(name: string, limit = 20): any[] {
  const results: any[] = []

  try {
    const g = globalThis as any
    // React DevTools hook exposes the fiber root.
    const hook = g.__REACT_DEVTOOLS_GLOBAL_HOOK__
    if (!hook) return results

    const renderers: Map<number, any> = hook.renderers
    if (!renderers) return results

    for (const renderer of renderers.values()) {
      const roots = renderer.getFiberRoots?.() ?? []
      for (const root of roots) {
        walk(root.current, name, results, limit)
        if (results.length >= limit) return results
      }
    }
  } catch { /* */ }

  return results
}

function walk(fiber: any, name: string, out: any[], limit: number, depth = 0) {
  if (!fiber || depth > 50 || out.length >= limit) return

  const typeName =
    fiber.type?.displayName ?? fiber.type?.name ?? fiber.elementType?.name ?? ''

  if (typeName.toLowerCase().includes(name.toLowerCase())) {
    out.push(fiber)
  }

  walk(fiber.child, name, out, limit, depth + 1)
  walk(fiber.sibling, name, out, limit, depth + 1)
}

function serializeProps(props: any): string {
  try {
    const safe: Record<string, string> = {}
    for (const key of Object.keys(props ?? {})) {
      const val = props[key]
      if (typeof val === 'function') safe[key] = '[Function]'
      else if (typeof val === 'object' && val !== null) safe[key] = '[Object]'
      else safe[key] = String(val)
    }
    return JSON.stringify(safe, null, 2)
  } catch {
    return '(serialization failed)'
  }
}

export function ComponentTab() {
  const { ScrollView, TextInput, View } = ReactNative
  const { Button, TableRow, TableRowGroup, Text } = Design

  const [query, setQuery] = React.useState('')
  const [fibers, setFibers] = React.useState<any[]>([])
  const [searched, setSearched] = React.useState(false)

  const search = () => {
    setFibers(findFibersByName(query.trim()))
    setSearched(true)
  }

  return h(
    ScrollView,
    { style: { flex: 1 } },
    h(
      View,
      { style: { padding: 16, gap: 12 } },
      h(Text, { variant: 'heading-md/semibold' }, 'Component Inspector'),
      h(Text, { variant: 'text-sm/medium', color: 'text-muted' }, 'Find rendered React components by name and inspect their props.'),

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
          placeholder: 'e.g. ChannelsList',
          placeholderTextColor: '#888',
          value: query,
          onChangeText: setQuery,
          onSubmitEditing: search,
          returnKeyType: 'search',
        }),
        h(Button, { text: 'Find', variant: 'primary', onPress: search }),
      ),

      searched && fibers.length === 0
        ? h(
            Text,
            { variant: 'text-md/medium', color: 'text-muted' },
            'No matching components found in the current React tree. Make sure the view is rendered.',
          )
        : null,

      fibers.length > 0
        ? h(
            TableRowGroup,
            { title: `Matches (${fibers.length})` },
            fibers.map((fiber, i) =>
              h(TableRow, {
                key: i,
                label: fiber.type?.displayName ?? fiber.type?.name ?? '(anonymous)',
                subLabel: serializeProps(fiber.memoizedProps),
                subLabelLineClamp: 6,
              }),
            ),
          )
        : null,
    ),
  )
}
