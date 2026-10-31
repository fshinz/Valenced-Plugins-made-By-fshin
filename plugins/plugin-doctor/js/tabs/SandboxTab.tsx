import { Design } from '@valenced/discord/design'
import { Clipboard } from '@valenced/externals/react-native-clipboard'
import { React, ReactNative } from '@valenced/react'

const h = (...args: any[]) => React.createElement(...args)

function buildContext(): Record<string, unknown> {
  const ctx: Record<string, unknown> = {}

  const tryGet = (path: string) => {
    try { return (globalThis as any).__valenced?.require?.(path) ?? null } catch { return null }
  }

  const design = tryGet('@valenced/discord/design')
  if (design) Object.assign(ctx, design)

  const react = tryGet('@valenced/react')
  if (react) { ctx.React = react.React; ctx.ReactNative = react.ReactNative }

  const finders = tryGet('@valenced/modules/finders')
  if (finders) { ctx.getModules = finders.getModules; ctx.withProps = finders.withProps; ctx.withName = finders.withName }

  const patcher = tryGet('@valenced/patcher')
  if (patcher) { ctx.before = patcher.before; ctx.after = patcher.after; ctx.instead = patcher.instead }

  const clip = tryGet('@valenced/externals/react-native-clipboard')
  if (clip) ctx.Clipboard = clip.Clipboard ?? clip

  const flux = (globalThis as any).__valenced?.flux
  if (flux) {
    ctx.Flux = flux
    ctx.getStore = (name: string) => flux.getStore?.(name)
  }

  ctx.log = (...args: any[]) => console.log('[Sandbox]', ...args)

  return ctx
}

export type SandboxResult = {
  ok: boolean
  value?: string
  error?: string
  duration: number
}

function runSandbox(code: string): SandboxResult {
  const start = Date.now()

  try {
    const ctx = buildContext()
    const keys = Object.keys(ctx)
    const vals = keys.map(k => ctx[k])

    // eslint-disable-next-line no-new-func
    const fn = new Function(
      ...keys,
      `"use strict"; try { const __r = (function(){ ${code} })(); if(__r && typeof __r.then === 'function'){ return __r.then(function(v){ return String(v == null ? 'undefined' : v); }); } return String(__r == null ? 'undefined' : __r); } catch(e){ throw e; }`,
    )

    const raw = fn(...vals)

    if (raw && typeof (raw as any).then === 'function') {
      ;(raw as Promise<any>)
        .then(v => console.log('[Sandbox async result]', v))
        .catch(e => console.error('[Sandbox async error]', e))
      return { ok: true, value: '(async — check console for result)', duration: Date.now() - start }
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

const EXAMPLES = [
  {
    label: 'List Design keys',
    code: `return Object.keys(Design || {}).join(', ')`,
  },
  {
    label: 'Find module by prop',
    code: `getModules(withProps('getChannel'), function(m){ log(m) })\nreturn 'check console'`,
  },
  {
    label: 'List all store names',
    code: `return Object.keys(Flux?._stores ?? Flux?.stores ?? {}).join(', ')`,
  },
  {
    label: 'Get guild count',
    code: `var gs = getStore('GuildStore')\nreturn gs ? Object.keys(gs.getGuilds?.() ?? {}).length + ' guilds' : 'GuildStore not found'`,
  },
]

export function SandboxTab() {
  const { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } = ReactNative
  const { Button, Text, TableRow, TableRowGroup } = Design

  const [code, setCode] = React.useState('')
  const [result, setResult] = React.useState<SandboxResult | null>(null)

  const run = () => setResult(runSandbox(code))

  const copy = () => {
    const text = result?.value ?? result?.error ?? ''
    if (text) Clipboard.setString(text)
  }

  return h(
    KeyboardAvoidingView,
    {
      style: { flex: 1 },
      behavior: Platform.OS === 'ios' ? 'padding' : 'height',
      keyboardVerticalOffset: 120,
    },
    h(
      ScrollView,
      { style: { flex: 1 }, keyboardShouldPersistTaps: 'handled' },
      h(
        View,
        { style: { padding: 16, gap: 12 } },

        h(Text, { variant: 'heading-md/semibold' }, 'Plugin Sandbox'),
        h(
          Text,
          { variant: 'text-sm/medium', color: 'text-muted' },
          'Run JS snippets with Valenced APIs pre-loaded. Available: Design, React, ReactNative, getModules, withProps, withName, Clipboard, Flux, getStore, log.',
        ),

        h(
          TableRowGroup,
          { title: 'Quick examples' },
          EXAMPLES.map(ex =>
            h(TableRow, {
              key: ex.label,
              label: ex.label,
              onPress: () => { setCode(ex.code); setResult(null) },
            }),
          ),
        ),

        h(
          View,
          {
            style: {
              borderWidth: 1,
              borderColor: '#444',
              borderRadius: 10,
              backgroundColor: '#111214',
              overflow: 'hidden',
            },
          },
          h(
            View,
            {
              style: {
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingTop: 8,
                paddingBottom: 4,
              },
            },
            h(Text, { variant: 'text-xs/semibold', color: 'text-muted' }, 'SNIPPET'),
            code.length > 0
              ? h(
                  Text,
                  {
                    variant: 'text-xs/medium',
                    color: 'text-link',
                    onPress: () => { setCode(''); setResult(null) },
                  },
                  'Clear',
                )
              : null,
          ),
          h(TextInput, {
            style: {
              color: '#e6edf3',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 20,
              minHeight: 140,
              paddingHorizontal: 12,
              paddingBottom: 12,
              textAlignVertical: 'top',
            },
            multiline: true,
            scrollEnabled: false,
            placeholder: '// e.g.\nreturn Object.keys(Design || {}).join(", ")',
            placeholderTextColor: '#555',
            value: code,
            onChangeText: setCode,
            autoCapitalize: 'none',
            autoCorrect: false,
            spellCheck: false,
          }),
        ),

        h(Button, {
          text: 'Run',
          variant: 'primary',
          disabled: !code.trim(),
          onPress: run,
        }),

        result != null
          ? h(
              View,
              {
                style: {
                  borderWidth: 1,
                  borderColor: result.ok ? '#2d6a4f' : '#7a1a1a',
                  borderRadius: 10,
                  backgroundColor: result.ok ? '#0d1f17' : '#1a0d0d',
                  overflow: 'hidden',
                },
              },
              h(
                View,
                {
                  style: {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: result.ok ? '#2d6a4f' : '#7a1a1a',
                  },
                },
                h(
                  Text,
                  {
                    variant: 'text-sm/semibold',
                    color: result.ok ? 'text-positive' : 'text-danger',
                  },
                  result.ok ? `✓ OK  ·  ${result.duration}ms` : `✗ Error  ·  ${result.duration}ms`,
                ),
                h(
                  Text,
                  { variant: 'text-sm/medium', color: 'text-link', onPress: copy },
                  'Copy',
                ),
              ),
              h(TextInput, {
                style: {
                  color: result.ok ? '#3fb950' : '#f85149',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 18,
                  padding: 12,
                  textAlignVertical: 'top',
                },
                multiline: true,
                scrollEnabled: false,
                editable: false,
                value: result.ok ? (result.value ?? '') : (result.error ?? ''),
              }),
            )
          : null,
      ),
    ),
  )
}