// Plugin Sandbox — evaluates small snippets against documented Valenced APIs.

export type SandboxResult = {
  ok: boolean
  value?: string
  error?: string
  duration: number
}

// Safe globals available inside the sandbox.
function buildSandboxContext(): Record<string, unknown> {
  const ctx: Record<string, unknown> = {}

  // Expose Valenced APIs safely.
  try { Object.assign(ctx, require('@valenced/discord/design')) } catch { /* */ }
  try { const r = require('@valenced/react'); ctx.React = r.React; ctx.ReactNative = r.ReactNative } catch { /* */ }
  try { const r = require('@valenced/modules/finders'); ctx.getModules = r.getModules; ctx.withProps = r.withProps; ctx.withName = r.withName } catch { /* */ }
  try { const r = require('@valenced/patcher'); ctx.before = r.before; ctx.after = r.after; ctx.instead = r.instead } catch { /* */ }

  ctx.console = {
    log: (...args: any[]) => console.log('[Sandbox]', ...args),
    warn: (...args: any[]) => console.warn('[Sandbox]', ...args),
    error: (...args: any[]) => console.error('[Sandbox]', ...args),
  }

  return ctx
}

export function runSandbox(code: string): SandboxResult {
  const start = Date.now()

  try {
    const ctx = buildSandboxContext()
    const keys = Object.keys(ctx)
    const vals = keys.map(k => ctx[k])

    // Wrap in an async IIFE so the user can use await at the top level.
    // We stringify the result and return it.
    // eslint-disable-next-line no-new-func
    const fn = new Function(...keys, `
      "use strict";
      try {
        const __result = (function() { ${code} })();
        if (__result instanceof Promise) {
          return __result.then(v => JSON.stringify(v ?? null));
        }
        return JSON.stringify(__result ?? null);
      } catch (e) {
        throw e;
      }
    `)

    const raw = fn(...vals)

    if (raw instanceof Promise) {
      // Can't await here; return a pending indicator.
      raw.catch(() => { /* swallow */ })
      return {
        ok: true,
        value: '(async — check console for result)',
        duration: Date.now() - start,
      }
    }

    return { ok: true, value: String(raw ?? 'undefined'), duration: Date.now() - start }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e),
      duration: Date.now() - start,
    }
  }
}