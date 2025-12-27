import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createDaemonRunContext } from '../src/daemon/summarize-run.js'

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), 'summarize-daemon-home-'))
}

describe('daemon/summarize-run (overrides)', () => {
  it('defaults to xl + auto language when unset', () => {
    const home = makeTempHome()
    const ctx = createDaemonRunContext({
      env: { HOME: home },
      fetchImpl: fetch,
      modelOverride: null,
      lengthRaw: '',
      languageRaw: '',
      sink: { writeChunk: () => {}, onModelChosen: () => {} },
    })

    expect(ctx.summaryLength).toBe('xl')
    expect(ctx.outputLanguage).toEqual({ kind: 'auto' })
  })

  it('accepts custom length and language overrides', () => {
    const home = makeTempHome()
    const ctx = createDaemonRunContext({
      env: { HOME: home },
      fetchImpl: fetch,
      modelOverride: null,
      lengthRaw: '20k',
      languageRaw: 'German',
      sink: { writeChunk: () => {}, onModelChosen: () => {} },
    })

    expect(ctx.summaryLength).toEqual({ maxCharacters: 20000 })
    expect(ctx.outputLanguage.kind).toBe('fixed')
    expect(ctx.outputLanguage.kind === 'fixed' ? ctx.outputLanguage.tag : null).toBe('de')
  })

  it('adjusts desired output tokens based on length', () => {
    const home = makeTempHome()
    const shortCtx = createDaemonRunContext({
      env: { HOME: home },
      fetchImpl: fetch,
      modelOverride: null,
      lengthRaw: 'short',
      languageRaw: 'auto',
      sink: { writeChunk: () => {}, onModelChosen: () => {} },
    })
    const xlCtx = createDaemonRunContext({
      env: { HOME: home },
      fetchImpl: fetch,
      modelOverride: null,
      lengthRaw: 'xl',
      languageRaw: 'auto',
      sink: { writeChunk: () => {}, onModelChosen: () => {} },
    })

    const shortTokens = shortCtx.desiredOutputTokens
    const xlTokens = xlCtx.desiredOutputTokens
    if (typeof shortTokens !== 'number' || typeof xlTokens !== 'number') {
      throw new Error('expected desiredOutputTokens to be a number')
    }
    expect(shortTokens).toBeLessThan(xlTokens)
  })
})
