import { Design } from '@valenced/discord/design'
import { React, ReactNative } from '@valenced/react'
import { CompatibilityTab } from './tabs/CompatibilityTab'
import { ComponentTab } from './tabs/ComponentTab'
import { ErrorsTab } from './tabs/ErrorsTab'
import { MetroTab } from './tabs/MetroTab'
import { SandboxTab } from './tabs/SandboxTab'
import { WatchTab } from './tabs/WatchTab'

const h = (...args: any[]) => React.createElement(...args)

const TABS = [
  { id: 'errors', label: 'Errors', Tab: ErrorsTab },
  { id: 'metro', label: 'Metro', Tab: MetroTab },
  { id: 'component', label: 'Component', Tab: ComponentTab },
  { id: 'compat', label: 'Compat', Tab: CompatibilityTab },
  { id: 'watch', label: 'Watch', Tab: WatchTab },
  { id: 'sandbox', label: 'Sandbox', Tab: SandboxTab },
]

export function PluginDoctorSettings() {
  const { SegmentedControlPages, Tabs, useSegmentedControlState } = Design
  const { View, useWindowDimensions } = ReactNative
  const { width } = useWindowDimensions()

  const items = React.useMemo(
    () => TABS.map(({ id, label, Tab }) => ({ id, label, page: h(Tab, null) })),
    [],
  )
  const state = useSegmentedControlState({ items, pageWidth: width })

  return h(
    View,
    { style: { flex: 1 } },
    // Tabs is a ScrollView, which grows by default and would fill the whole column.
    h(View, { style: { flexGrow: 0, flexShrink: 0 } }, h(Tabs, { state, grow: false })),
    h(SegmentedControlPages, { state, style: { flex: 1 } }),
  )
}
