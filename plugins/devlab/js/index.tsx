import * as settings from '@valenced/discord/modules/settings'
import { lookupGeneratedIconComponent } from '@valenced/utils/discord'
import { setPluginApi } from './api'
import { DevLabSettings } from './settings'
import { bindStorage, recordError } from './storage'
import { TOOLS } from './tools'
import type { DevLabState } from './storage'

const SETTINGS_KEY = 'shin.devlab.settings'

const toolItems: Record<string, settings.SettingsItem> = {}
for (const { route, title, Screen } of TOOLS) {
	toolItems[route] = {
		type: 'route',
		parent: null,
		unsearchable: true,
		useTitle: () => title,
		screen: { route, getComponent: () => Screen },
	}
}

export default plugin<{ jsonStorage: DevLabState }>({
	jsonStorage: {
		load: true,
		default: { entries: [], enabled: true },
	},

	SettingsComponent: DevLabSettings,

	start({ cleanup, plugin: self, jsonStorage }) {
		bindStorage(jsonStorage)
		setPluginApi(self)

		self.reportError = error => recordError(error, 'Reported plugin error')

		const errorUtils = (globalThis as any).ErrorUtils
		const previousHandler = errorUtils?.getGlobalHandler?.()

		errorUtils?.setGlobalHandler?.((error: Error, isFatal: boolean) => {
			recordError(error, isFatal ? 'Fatal error' : 'Unhandled error')
			previousHandler?.(error, isFatal)
		})

		cleanup(() => {
			if (previousHandler) errorUtils?.setGlobalHandler?.(previousHandler)
		})

		const undo: Array<() => void> = []

		const stopListening = settings.onSettingsModulesLoaded(() => {
			undo.push(
				settings.registerSettingsItems({
					[SETTINGS_KEY]: {
						type: 'route',
						parent: null,
						IconComponent: lookupGeneratedIconComponent('WrenchIcon'),
						useTitle: () => 'DevLab',
						screen: { route: SETTINGS_KEY, getComponent: () => DevLabSettings },
					},
					...toolItems,
				}),
				settings.registerSettingsSection(SETTINGS_KEY, {
					label: 'DevLab',
					settings: [SETTINGS_KEY],
					index: 1,
				}),
			)
			settings.refreshSettings()
		})

		cleanup(stopListening, () => {
			for (const remove of undo.splice(0)) {
				try {
					remove()
				} catch {
					// Already removed along with its section.
				}
			}
			settings.refreshSettings()
		})
	},
})
