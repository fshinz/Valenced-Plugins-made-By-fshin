import { lookupModules } from '@valenced/modules/finders'
import {
	createFilterGenerator,
	FilterScopes,
} from '@valenced/modules/finders/filters'

const anyModule = createFilterGenerator<[]>(
	() => true,
	() => 'devlab.any-module',
	FilterScopes.Uninitialized | FilterScopes.Initialized,
)

// Uncached, or a scan after loading everything returns the earlier result.
export function getModuleEntries(initialize = false): [string, any][] {
	const entries: [string, any][] = []
	for (const [exports, id] of lookupModules(anyModule(), {
		initialize,
		cached: false,
		returnNamespace: true,
	})) {
		if (exports) entries.push([String(id), exports])
	}
	return entries
}
