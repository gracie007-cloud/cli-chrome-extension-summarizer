import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { loadSummarizeConfig } from '../src/config.js'

describe('config loading', () => {
  it('loads ~/.summarize/config.json by default', () => {
    const root = mkdtempSync(join(tmpdir(), 'summarize-config-'))
    const configDir = join(root, '.summarize')
    mkdirSync(configDir, { recursive: true })
    const configPath = join(configDir, 'config.json')
    writeFileSync(configPath, JSON.stringify({ model: 'openai/gpt-5.2' }), 'utf8')

    const result = loadSummarizeConfig({ env: { HOME: root } })
    expect(result.path).toBe(configPath)
    expect(result.config).toEqual({ model: 'openai/gpt-5.2' })
  })
})
