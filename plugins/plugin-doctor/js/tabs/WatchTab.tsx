import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'
import {
  addWatchListener,
  clearAllWatches,
  getAllStoreNames,
  getWatchedStores,
  unwatchStore,
  watchStore,
  type WatchEntry,
} from '../features/livewatch'

const h = (...args: any[]) => React.createElement(...args)

const MAX_LOG = 100

export function WatchTab() {
  const { ScrollView, TextInput, View } = ReactNative
  const { Button, TableRow, TableRowGroup, Text } = Design

  const [storeFilter, setStoreFilter] = React.useState('')
  const [watched, setWatched] = React.useState<string[]>([])
  const [log, setLog] = React.useState<WatchEntry[]>([])
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null)
  const [showPicker, setShowPicker] = React.useState(false)

  const allStores = React.useMemo(() => getAllStoreNames(), [showPicker])

  React.useEffect(() => {
    setWatched(getWatchedStores())
    const unsub = addWatchListener(entry => {
      setLog(prev => [entry, ...prev].slice(0, MAX_LOG))
    })
    return () => {
      unsub()
      clearAllWatches()
    }
  }, [])

  const toggle = (name: string) => {
    const isWatched = watched.includes(name)
    if (isWatched) {
      unwatchStore(name)
    } else {
      watchStore(name)
    }
    setWatched(getWatchedStores())
  }

  const clearLog = () => { setLog([]); setExpandedIdx(null) }

  const copyLog = () => {
    Clipboard.setString(
      log.map(e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.storeName}\n${e.snapshot}`).join('\n\n---\n\n') || 'No events.',
    )
  }

  const filtered = storeFilter.length >= 2
    ? allStores.filter(n => n.toLowerCase().includes(storeFilter.toLowerCase()))
    : allStores

  return h(
    ScrollView,
    { style: { flex: 1 }, keyboardShouldPersistTaps: 'handled' },
    h(
      View,
      { style: { padding: 16, gap: 16 } },

      // ── store picker ──────────────────────────────────────────────
      h(
        TableRowGroup,
        { title: `Available stores (${allStores.length})` },
        allStores.length === 0
          ? h(TableRow, { label: 'Flux store registry not found.', subLabel: 'Stores will appear here once Valenced exposes the registry.' })
          : h(TableRow, {
              label: showPicker ? 'Hide store list' : 'Browse & pick stores…',
              onPress: () => setShowPicker(v => !v),
            }),
      ),

      showPicker && allStores.length > 0
        ? h(
            TableRowGroup,
            { title: 'Pick stores to watch' },
            h(TextInput, {
              style: {
                padding: 10,
                color: '#fff',
                fontSize: 13,
              },
              placeholder: 'Filter…',
              placeholderTextColor: '#666',
              value: storeFilter,
              onChangeText: setStoreFilter,
              autoCapitalize: 'none',
              autoCorrect: false,
            }),
            filtered.slice(0, 80).map(name =>
              h(TableRow, {
                key: name,
                label: name,
                subLabel: watched.includes(name) ? 'Watching' : undefined,
                onPress: () => toggle(name),
                trailing: watched.includes(name)
                  ? h(Text, { variant: 'text-sm/semibold', color: 'text-positive' }, '✓')
                  : null,
              }),
            ),
            filtered.length > 80
              ? h(TableRow, { label: `… ${filtered.length - 80} more. Narrow filter to see them.` })
              : null,
          )
        : null,

      // ── currently watching ───────────────────────────────────────
      watched.length > 0
        ? h(
            TableRowGroup,
            { title: `Watching (${watched.length})` },
            watched.map(name =>
              h(TableRow, {
                key: name,
                label: name,
                onPress: () => toggle(name),
                trailing: h(Text, { variant: 'text-sm/medium', color: 'text-danger' }, 'Remove'),
              }),
            ),
          )
        : null,

      // ── log controls ─────────────────────────────────────────────
      log.length > 0
        ? h(
            View,
            { style: { flexDirection: 'row', gap: 8 } },
            h(Button, { text: 'Copy log', variant: 'secondary', onPress: copyLog }),
            h(Button, { text: 'Clear log', variant: 'destructive', onPress: clearLog }),
          )
        : null,

      // ── event log ────────────────────────────────────────────────
      h(
        TableRowGroup,
        { title: `Event log (${log.length}/${MAX_LOG})` },
        log.length === 0
          ? h(TableRow, {
              label: watched.length === 0 ? 'No stores selected.' : 'Waiting for store changes…',
            })
          : log.map((entry, i) =>
              h(TableRow, {
                key: i,
                label: entry.storeName,
                subLabel: expandedIdx === i
                  ? `${new Date(entry.timestamp).toLocaleTimeString()}\n\n${entry.snapshot}`
                  : new Date(entry.timestamp).toLocaleTimeString(),
                subLabelLineClamp: expandedIdx === i ? 30 : 1,
                onPress: () => setExpandedIdx(expandedIdx === i ? null : i),
                trailing: expandedIdx === i
                  ? h(Text, {
                      variant: 'text-sm/medium',
                      color: 'text-link',
                      onPress: (e: any) => { e?.stopPropagation?.(); Clipboard.setString(entry.snapshot) },
                    }, 'Copy')
                  : null,
              }),
            ),
      ),
    ),
  )
}