import { Design } from '@valenced/discord/design'
import { React, ReactNative } from '@valenced/react'
import { CompatibilityTab } from './tabs/CompatibilityTab'
import { ComponentTab } from './tabs/ComponentTab'
import { ErrorsTab } from './tabs/ErrorsTab'
import { MetroTab } from './tabs/MetroTab'
import { SandboxTab } from './tabs/SandboxTab'
import { WatchTab } from './tabs/WatchTab'

const TABS = [
	{ id: 'errors', label: 'Errors', Tab: ErrorsTab },
	{ id: 'metro', label: 'Metro', Tab: MetroTab },
	{ id: 'component', label: 'Component', Tab: ComponentTab },
	{ id: 'compat', label: 'Compat', Tab: CompatibilityTab },
	{ id: 'watch', label: 'Watch', Tab: WatchTab },
	{ id: 'sandbox', label: 'Sandbox', Tab: SandboxTab },
]

export function DevLabSettings() {
	const { SegmentedControl, SegmentedControlPages, useSegmentedControlState } =
		Design
	const { View, useWindowDimensions } = ReactNative
	const { width } = useWindowDimensions()

	const items = React.useMemo(
		() => TABS.map(({ id, label, Tab }) => ({ id, label, page: <Tab /> })),
		[],
	)
	const state = useSegmentedControlState({ items, pageWidth: width })

	return (
		<View style={{ flex: 1 }}>
			{/* SegmentedControl is a ScrollView, which grows by default and would fill the column. */}
			<View
				style={{
					flexGrow: 0,
					flexShrink: 0,
					paddingHorizontal: 16,
					paddingVertical: 12,
				}}
			>
				<SegmentedControl state={state} />
			</View>
			<SegmentedControlPages state={state} style={{ flex: 1 }} />
		</View>
	)
}
