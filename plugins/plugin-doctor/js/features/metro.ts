// Metro module inspector — searches available exports.

export type MetroModule = {
  id: number
  exports: Record<string, unknown>
  matchedKeys: string[]
}

function getMetroRegistry(): Map<number, any> | null {
  try {
    // Hermes / Metro keeps a global __r / modules registry.
    const g = globalThis as any
    return g.__r?.registry ?? g.__metroModuleRegistry ?? null
  } catch {
    return null
  }
}

export function searchModules(query: string, limit = 50): MetroModule[] {
  const registry = getMetroRegistry()
  if (!registry) return []

  const lower = query.toLowerCase()
  const results: MetroModule[] = []

  for (const [id, mod] of registry) {
    if (results.length >= limit) break

    try {
      const exports = mod?.publicModule?.exports ?? mod?.exports
      if (!exports || typeof exports !== 'object') continue

      const keys = Object.keys(exports)
      const matched = keys.filter(k => k.toLowerCase().includes(lower))
      if (matched.length === 0) continue

      results.push({ id, exports, matchedKeys: matched })
    } catch {
      // Some modules throw on access; skip them.
    }
  }

  return results
}

export function inspectModule(id: number): Record<string, string> | null {
  const registry = getMetroRegistry()
  if (!registry) return null

  try {
    const mod = registry.get(id)
    const exports = mod?.publicModule?.exports ?? mod?.exports
    if (!exports || typeof exports !== 'object') return null

    const result: Record<string, string> = {}
    for (const key of Object.keys(exports)) {
      try {
        result[key] = typeof exports[key]
      } catch {
        result[key] = '(error)'
      }
    }
    return result
  } catch {
    return null
  }
}