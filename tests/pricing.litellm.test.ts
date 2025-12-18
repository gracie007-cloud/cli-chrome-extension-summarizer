import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { loadLiteLlmCatalog, resolveLiteLlmPricingForModelId } from '../src/pricing/litellm.js'

describe('LiteLLM pricing catalog', () => {
  it('does nothing without HOME (no cache, no network)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('unexpected fetch')
    })

    const result = await loadLiteLlmCatalog({ env: {}, fetchImpl: fetchMock as unknown as typeof fetch })
    expect(result.source).toBe('none')
    expect(result.catalog).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  it('loads from cache when fresh', async () => {
    const root = mkdtempSync(join(tmpdir(), 'summarize-litellm-'))
    const cacheDir = join(root, '.summarize', 'cache')
    mkdirSync(cacheDir, { recursive: true })

    const catalogPath = join(cacheDir, 'litellm-model_prices_and_context_window.json')
    const metaPath = join(cacheDir, 'litellm-model_prices_and_context_window.meta.json')

    writeFileSync(
      catalogPath,
      JSON.stringify({ 'gpt-5.2': { input_cost_per_token: 0.1, output_cost_per_token: 0.2 } }),
      'utf8'
    )
    writeFileSync(metaPath, JSON.stringify({ fetchedAtMs: 1_000 }), 'utf8')

    const fetchMock = vi.fn(async () => Response.json({}, { status: 500 }))
    const result = await loadLiteLlmCatalog({
      env: { HOME: root },
      fetchImpl: fetchMock as unknown as typeof fetch,
      nowMs: 1_000 + 1000,
    })
    expect(result.source).toBe('cache')
    expect(fetchMock).toHaveBeenCalledTimes(0)
    expect(resolveLiteLlmPricingForModelId(result.catalog ?? {}, 'openai/gpt-5.2')).toEqual({
      inputUsdPerToken: 0.1,
      outputUsdPerToken: 0.2,
    })
  })

  it('revalidates stale cache with 304', async () => {
    const root = mkdtempSync(join(tmpdir(), 'summarize-litellm-'))
    const cacheDir = join(root, '.summarize', 'cache')
    mkdirSync(cacheDir, { recursive: true })

    const catalogPath = join(cacheDir, 'litellm-model_prices_and_context_window.json')
    const metaPath = join(cacheDir, 'litellm-model_prices_and_context_window.meta.json')

    writeFileSync(
      catalogPath,
      JSON.stringify({ 'gpt-5.2': { input_cost_per_token: 0.1, output_cost_per_token: 0.2 } }),
      'utf8'
    )
    writeFileSync(metaPath, JSON.stringify({ fetchedAtMs: 1, etag: '"abc"' }), 'utf8')

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect((init?.headers as Record<string, string> | undefined)?.['if-none-match']).toBe('"abc"')
      return new Response(null, { status: 304, headers: { etag: '"abc"' } })
    })

    const result = await loadLiteLlmCatalog({
      env: { HOME: root },
      fetchImpl: fetchMock as unknown as typeof fetch,
      nowMs: 1 + 8 * 24 * 60 * 60 * 1000,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.source).toBe('cache')
    expect(result.catalog).not.toBeNull()
  })

  it('downloads and caches when missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'summarize-litellm-'))
    const fetchMock = vi.fn(async () =>
      Response.json(
        { 'gpt-5.2': { input_cost_per_token: 0.1, output_cost_per_token: 0.2 } },
        { status: 200, headers: { etag: '"x"', 'last-modified': 'y' } }
      )
    )

    const result = await loadLiteLlmCatalog({
      env: { HOME: root },
      fetchImpl: fetchMock as unknown as typeof fetch,
      nowMs: 123,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.source).toBe('network')

    const cached = await loadLiteLlmCatalog({
      env: { HOME: root },
      fetchImpl: vi.fn(async () => Response.json({}, { status: 500 })) as unknown as typeof fetch,
      nowMs: 123 + 1000,
    })
    expect(cached.source).toBe('cache')
    expect(resolveLiteLlmPricingForModelId(cached.catalog ?? {}, 'gpt-5.2')).toEqual({
      inputUsdPerToken: 0.1,
      outputUsdPerToken: 0.2,
    })
  })
})

