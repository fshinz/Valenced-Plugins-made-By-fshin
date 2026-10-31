import { Page, SearchInput } from '@valenced/components'
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
  const { ScrollView } = ReactNative
  const { Button, Stack, TableRow, TableRowGroup } = Design

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
    { keyboardShouldPersistTaps: 'handled', contentContainerStyle: { paddingBottom: 32 } },
    h(
      Page,
      { spacing: 16 },

      h(
        TableRowGroup,
        { title: `Available stores (${allStores.length})` },
        allStores.length === 0
          ? h(TableRow, { label: 'Flux store registry not found.', subLabel: 'Stores will appear here once Valenced exposes the registry.' })
          : h(TableRow, {
              label: showPicker ? 'Hide store list' : 'Browse & pick stores',
              arrow: true,
              onPress: () => setShowPicker(v => !v),
            }),
      ),

      showPicker && allStores.length > 0
        ? [
            h(SearchInput, {
              key: 'filter',
              value: storeFilter,
              onChange: setStoreFilter,
              placeholder: 'Filter stores',
              isClearable: true,
              autoCapitalize: 'none',
              autoCorrect: false,
            }),
            h(
              TableRowGroup,
              { key: 'picker', title: 'Pick stores to watch' },
              filtered.slice(0, 80).map(name =>
                h(TableRow, {
                  key: name,
                  label: name,
                  trailing: watched.includes(name) ? h(TableRow.TrailingText, { text: 'Watching' }) : null,
                  onPress: () => toggle(name),
                }),
              ),
              filtered.length > 80
                ? h(TableRow, { label: `${filtered.length - 80} more. Narrow the filter to see them.` })
                : null,
            ),
          ]
        : null,

      watched.length > 0
        ? h(
            TableRowGroup,
            { title: `Watching (${watched.length})` },
            watched.map(name =>
              h(TableRow, {
                key: name,
                label: name,
                trailing: h(TableRow.TrailingText, { text: 'Remove' }),
                onPress: () => toggle(name),
              }),
            ),
          )
        : null,

      log.length > 0
        ? h(
            Stack,
            { direction: 'horizontal', spacing: 8 },
            h(Button, { text: 'Copy log', variant: 'secondary', grow: true, onPress: copyLog }),
            h(Button, { text: 'Clear log', variant: 'destructive', grow: true, onPress: clearLog }),
          )
        : null,

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
                subLabel:
                  expandedIdx === i
                    ? `${new Date(entry.timestamp).toLocaleTimeString()}\n\n${entry.snapshot}`
                    : new Date(entry.timestamp).toLocaleTimeString(),
                subLabelLineClamp: expandedIdx === i ? 30 : 1,
                trailing: expandedIdx === i ? h(TableRow.TrailingText, { text: 'Copy' }) : null,
                onPress: () => {
                  if (expandedIdx !== i) return setExpandedIdx(i)
                  Clipboard.setString(entry.snapshot)
                  setExpandedIdx(null)
                },
              }),
            ),
      ),
    ),
  )
}
