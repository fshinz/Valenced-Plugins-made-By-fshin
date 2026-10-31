import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'

const h = (...args: any[]) => React.createElement(...args)

type FiberInfo = {
  name: string
  depth: number
  propsJson: string
  source?: string
}

function collectFibers(filter: string, limit = 200): FiberInfo[] {
  const results: FiberInfo[] = []
  const lower = filter.toLowerCase()

  function walk(fiber: any, depth: number) {
    if (!fiber || depth > 80 || results.length >= limit) return

    try {
      const typeName: string =
        fiber.type?.displayName ??
        fiber.type?.name ??
        fiber.elementType?.displayName ??
        fiber.elementType?.name ??
        ''

      if (
        typeName &&
        typeName !== 'View' &&
        typeName !== 'Text' &&
        typeName !== 'RCTView' &&
        typeName !== 'RCTText' &&
        typeName !== 'StaticContainer' &&
        (!filter || typeName.toLowerCase().includes(lower))
      ) {
        const props = fiber.memoizedProps ?? fiber.pendingProps ?? {}
        const safe: Record<string, string> = {}
        for (const key of Object.keys(props)) {
          if (key === 'children') continue
          try {
            const val = props[key]
            safe[key] = typeof val === 'function' ? '[fn]'
              : typeof val === 'object' && val !== null ? JSON.stringify(val)
              : String(val)
          } catch { safe[key] = '(error)' }
        }

        results.push({
          name: typeName,
          depth,
          propsJson: JSON.stringify(safe, null, 2),
          source: fiber._debugSource
            ? `${fiber._debugSource.fileName?.split('/').pop()}:${fiber._debugSource.lineNumber}`
            : undefined,
        })
      }
    } catch { /* */ }

    walk(fiber.child, depth + 1)
    walk(fiber.sibling, depth)
  }

  try {
    const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
    if (!hook) return results

    for (const renderer of (hook.renderers ?? new Map()).values()) {
      for (const root of (renderer.getFiberRoots?.() ?? [])) {
        walk(root.current, 0)
        if (results.length >= limit) break
      }
    }
  } catch { /* */ }

  return results
}

export function ComponentTab() {
  const { KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity, View } = ReactNative
  const { Button, Text } = Design

  const [filter, setFilter] = React.useState('')
  const [components, setComponents] = React.useState<FiberInfo[]>([])
  const [scanned, setScanned] = React.useState(false)
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null)

  const scan = () => {
    setComponents(collectFibers(filter))
    setScanned(true)
    setExpandedIdx(null)
  }

  const copyItem = (item: FiberInfo) => {
    Clipboard.setString(`${item.name}\n${item.propsJson}`)
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

      h(
        View,
        {
          style: {
            padding: 16,
            gap: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#2e3035',
          },
        },
        h(Text, { variant: 'heading-md/semibold' }, 'Component Inspector'),
        h(
          Text,
          { variant: 'text-sm/medium', color: 'text-muted' },
          'Walks the live React fiber tree. Tap a component to expand its props.',
        ),
        h(
          View,
          { style: { flexDirection: 'row', gap: 8, alignItems: 'center' } },
          h(TextInput, {
            style: {
              flex: 1,
              backgroundColor: '#2b2d31',
              color: '#fff',
              padding: 10,
              borderRadius: 8,
              fontSize: 13,
            },
            placeholder: 'Filter by name (optional)',
            placeholderTextColor: '#666',
            value: filter,
            onChangeText: setFilter,
            autoCapitalize: 'none',
            autoCorrect: false,
            returnKeyType: 'search',
            onSubmitEditing: scan,
          }),
          h(Button, { text: 'Scan', variant: 'primary', onPress: scan }),
        ),
        scanned
          ? h(
              Text,
              { variant: 'text-xs/medium', color: 'text-muted' },
              `${components.length} component${components.length === 1 ? '' : 's'} found`,
            )
          : null,
      ),

      h(
        ScrollView,
        { style: { flex: 1 }, keyboardShouldPersistTaps: 'handled' },

        !scanned
          ? h(
              View,
              { style: { padding: 32, alignItems: 'center' } },
              h(
                Text,
                { variant: 'text-sm/medium', color: 'text-muted', style: { textAlign: 'center' } },
                'Hit Scan to walk the current React tree.',
              ),
            )
          : components.length === 0
            ? h(
                View,
                { style: { padding: 32, alignItems: 'center' } },
                h(
                  Text,
                  { variant: 'text-sm/medium', color: 'text-muted', style: { textAlign: 'center' } },
                  filter
                    ? `No components matched "${filter}".`
                    : 'React DevTools hook not found or tree is empty.',
                ),
              )
            : components.map((item, i) =>
                h(
                  TouchableOpacity,
                  {
                    key: i,
                    onPress: () => setExpandedIdx(expandedIdx === i ? null : i),
                    style: {
                      borderBottomWidth: 1,
                      borderBottomColor: '#2e303566',
                      padding: 12,
                      paddingLeft: 12 + item.depth * 4,
                    },
                  },
                  h(
                    View,
                    { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' } },
                    h(
                      View,
                      { style: { flex: 1 } },
                      h(Text, { variant: 'text-sm/semibold', color: 'text-link' }, item.name),
                      item.source
                        ? h(Text, { variant: 'text-xs/medium', color: 'text-muted' }, item.source)
                        : null,
                    ),
                    expandedIdx === i
                      ? h(
                          Text,
                          {
                            variant: 'text-xs/medium',
                            color: 'text-link',
                            onPress: (e: any) => { e.stopPropagation?.(); copyItem(item) },
                            style: { paddingLeft: 8 },
                          },
                          'Copy',
                        )
                      : null,
                  ),
                  expandedIdx === i
                    ? h(
                        Text,
                        {
                          selectable: true,
                          variant: 'text-xs/normal',
                          style: {
                            fontFamily: 'monospace',
                            color: '#3fb950',
                            lineHeight: 16,
                            marginTop: 8,
                          },
                        },
                        item.propsJson === '{}'
                          ? '(no props)'
                          : item.propsJson,
                      )
                    : null,
                ),
              ),
      ),
    ),
  )
}