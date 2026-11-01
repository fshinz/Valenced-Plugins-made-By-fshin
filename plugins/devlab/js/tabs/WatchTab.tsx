import { Page, SearchInput } from '@valenced/components'
import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'
import {
  addWatchListener,
  clearAllWatches,
  clearWatchLog,
  getAllStoreNames,
  getWatchedStores,
  getWatchLog,
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
  const [watched, setWatched] = React.useState<string[]>(() => getWatchedStores())
  const [log, setLog] = React.useState<WatchEntry[]>(() => getWatchLog())
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [showPicker, setShowPicker] = React.useState(false)
  const [, refreshStores] = React.useReducer((n: number) => n + 1, 0)
  const allStores = React.useMemo(() => getAllStoreNames(), [showPicker, storeFilter])

  React.useEffect(() => {
    const unsub = addWatchListener(entry => {
      setLog(getWatchLog())
      setWatched(getWatchedStores())
    })
    return () => { unsub() }
  }, [])

  const toggle = (name: string) => {
    if (watched.includes(name)) unwatchStore(name)
    else watchStore(name)
    setWatched(getWatchedStores())
    setLog(getWatchLog())
  }
  const clearLog = () => { clearWatchLog(); setLog([]); setExpandedId(null) }
  const copyLog = () => Clipboard.setString(log.map(e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.storeName}\n${e.snapshot}`).join('\n\n---\n\n') || 'No events.')
  const filtered = storeFilter.length >= 1 ? allStores.filter(n => n.toLowerCase().includes(storeFilter.toLowerCase())) : allStores

  return h(ScrollView, { keyboardShouldPersistTaps: 'handled', contentContainerStyle: { paddingBottom: 32 } },
    h(Page, { spacing: 16 },
      h(TableRowGroup, { title: `Available stores (${allStores.length})` },
        allStores.length === 0
          ? h(TableRow, { label: 'Flux store registry not found.', subLabel: 'The store registry is not exposed by the current client.' })
          : h(TableRow, { label: showPicker ? 'Hide store list' : 'Browse & pick stores', subLabel: 'Choose stores to monitor for changes.', arrow: true, onPress: () => { setShowPicker(v => !v); refreshStores() } }),
      ),
      showPicker && allStores.length > 0 ? [
        h(SearchInput, { key: 'filter', value: storeFilter, onChange: setStoreFilter, placeholder: 'Filter stores', isClearable: true, autoCapitalize: 'none', autoCorrect: false }),
        h(TableRowGroup, { key: 'picker', title: 'Pick stores to watch' },
          filtered.slice(0, 100).map(name => h(TableRow, { key: name, label: name, trailing: h(TableRow.TrailingText, { text: watched.includes(name) ? 'Watching' : 'Watch' }), onPress: () => toggle(name) })),
          filtered.length > 100 ? h(TableRow, { label: `${filtered.length - 100} more. Narrow the filter to see them.` }) : null,
        ),
      ] : null,
      watched.length > 0 ? h(TableRowGroup, { title: `Watching (${watched.length})` },
        watched.map(name => h(TableRow, { key: name, label: name, trailing: h(TableRow.TrailingText, { text: 'Stop' }), onPress: () => toggle(name) })),
      ) : null,
      h(Stack, { direction: 'horizontal', spacing: 8 },
        h(Button, { text: 'Copy log', variant: 'secondary', grow: true, disabled: log.length === 0, onPress: copyLog }),
        h(Button, { text: 'Clear log', variant: 'secondary', grow: true, disabled: log.length === 0, onPress: clearLog }),
      ),
      watched.length > 0 ? h(Button, { text: 'Stop all watches', variant: 'destructive', onPress: () => { clearAllWatches(); setWatched([]); setLog(getWatchLog()) } }) : null,
      h(TableRowGroup, { title: `Event log (${log.length}/${MAX_LOG})` },
        log.length === 0
          ? h(TableRow, { label: watched.length === 0 ? 'No events yet.' : 'Watching stores…', subLabel: watched.length === 0 ? 'Select a store above to begin.' : 'Changes will appear here. The log stays available when you leave this screen.' })
          : log.map(entry => h(TableRow, {
              key: entry.id,
              label: entry.storeName,
              subLabel: expandedId === entry.id ? `${new Date(entry.timestamp).toLocaleTimeString()}\n\n${entry.snapshot}` : `${new Date(entry.timestamp).toLocaleTimeString()} · ${entry.snapshot.slice(0, 100)}`,
              subLabelLineClamp: expandedId === entry.id ? 30 : 2,
              trailing: h(TableRow.TrailingText, { text: expandedId === entry.id ? 'Copy' : 'Details' }),
              onPress: () => {
                if (expandedId !== entry.id) setExpandedId(entry.id)
                else { Clipboard.setString(entry.snapshot); setExpandedId(null) }
              },
            })),
    ),
  ),
  )
}
