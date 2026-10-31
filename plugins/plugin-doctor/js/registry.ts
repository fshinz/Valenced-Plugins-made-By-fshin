import { lookupModules } from '@valenced/modules/finders'
import { createFilterGenerator } from '@valenced/modules/finders/filters'

const anyModule = createFilterGenerator<[]>(
  () => true,
  () => 'plugin-doctor.any-module',
)

// Initialized Metro modules as [id, exports]. Uninitialized ones are skipped so nothing gets side-loaded.
export function getModuleEntries(): [string, any][] {
  const entries: [string, any][] = []
  for (const [exports, id] of lookupModules(anyModule(), {
    initialize: false,
    returnNamespace: true,
  })) {
    if (exports) entries.push([String(id), exports])
  }
  return entries
}
