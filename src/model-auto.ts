import type { LiteLlmCatalog } from './pricing/litellm.js'
import { resolveLiteLlmMaxInputTokensForModelId, resolveLiteLlmPricingForModelId } from './pricing/litellm.js'
import type { AutoRule, AutoRuleCandidate, AutoRuleKind, SummarizeConfig } from './config.js'
import { normalizeGatewayStyleModelId, parseGatewayStyleModelId } from './llm/model-id.js'

export type AutoSelectionInput = {
  kind: AutoRuleKind
  promptTokens: number | null
  desiredOutputTokens: number | null
  requiresVideoUnderstanding: boolean
  env: Record<string, string | undefined>
  config: SummarizeConfig | null
  catalog: LiteLlmCatalog | null
  openrouterProvidersFromEnv: string[] | null
}

export type AutoModelAttempt = {
  userModelId: string
  llmModelId: string
  openrouterProviders: string[] | null
  forceOpenRouter: boolean
  requiredEnv: 'XAI_API_KEY' | 'OPENAI_API_KEY' | 'GEMINI_API_KEY' | 'ANTHROPIC_API_KEY' | 'OPENROUTER_API_KEY'
  debug: string
}

const DEFAULT_RULES: AutoRule[] = [
  {
    when: { kind: 'video' },
    candidates: [
      { model: 'google/gemini-3-flash-preview' },
      { model: 'google/gemini-2.5-flash-lite-preview-09-2025' },
    ],
  },
  {
    when: { kind: 'youtube' },
    candidates: [
      { model: 'openai/gpt-5-nano' },
      { model: 'google/gemini-3-flash-preview' },
      { model: 'xai/grok-4-fast-non-reasoning' },
    ],
  },
  {
    when: { kind: 'website' },
    candidates: [
      { model: 'openai/gpt-5-nano' },
      { model: 'openai/gpt-5.2' },
      { model: 'xai/grok-4-fast-non-reasoning' },
    ],
  },
  {
    when: { kind: 'text' },
    candidates: [
      { model: 'openai/gpt-5-nano' },
      { model: 'openai/gpt-5.2' },
      { model: 'xai/grok-4-fast-non-reasoning' },
    ],
  },
  {
    candidates: [
      { model: 'openai/gpt-5-nano' },
      { model: 'google/gemini-3-flash-preview' },
      { model: 'xai/grok-4-fast-non-reasoning' },
    ],
  },
]

function isCandidateOpenRouter(modelId: string): boolean {
  return modelId.trim().toLowerCase().startsWith('openrouter/')
}

function requiredEnvForCandidate(modelId: string): AutoModelAttempt['requiredEnv'] {
  if (isCandidateOpenRouter(modelId)) return 'OPENROUTER_API_KEY'
  const parsed = parseGatewayStyleModelId(normalizeGatewayStyleModelId(modelId))
  return parsed.provider === 'xai'
    ? 'XAI_API_KEY'
    : parsed.provider === 'google'
      ? 'GEMINI_API_KEY'
      : parsed.provider === 'anthropic'
        ? 'ANTHROPIC_API_KEY'
        : 'OPENAI_API_KEY'
}

function envHasKey(env: Record<string, string | undefined>, requiredEnv: AutoModelAttempt['requiredEnv']): boolean {
  if (requiredEnv === 'GEMINI_API_KEY') {
    return Boolean(env.GEMINI_API_KEY?.trim() || env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim())
  }
  return Boolean(env[requiredEnv]?.trim())
}

function resolveRuleCandidates(kind: AutoRuleKind, config: SummarizeConfig | null): AutoRuleCandidate[] {
  const rules = config?.auto?.rules?.length ? config.auto.rules : DEFAULT_RULES
  for (const rule of rules) {
    const whenKind = rule.when?.kind
    if (!whenKind || whenKind === kind) {
      return rule.candidates
    }
  }
  return DEFAULT_RULES[DEFAULT_RULES.length - 1].candidates
}

function estimateCostUsd({
  pricing,
  promptTokens,
  outputTokens,
}: {
  pricing: { inputUsdPerToken: number; outputUsdPerToken: number } | null
  promptTokens: number | null
  outputTokens: number | null
}): number | null {
  if (!pricing) return null
  if (typeof pricing.inputUsdPerToken !== 'number' || typeof pricing.outputUsdPerToken !== 'number') return null
  const inTok = typeof promptTokens === 'number' && Number.isFinite(promptTokens) && promptTokens > 0 ? promptTokens : 0
  const outTok = typeof outputTokens === 'number' && Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0
  const cost = inTok * pricing.inputUsdPerToken + outTok * pricing.outputUsdPerToken
  return Number.isFinite(cost) ? cost : null
}

function isVideoUnderstandingCapable(modelId: string): boolean {
  try {
    const parsed = parseGatewayStyleModelId(normalizeGatewayStyleModelId(modelId))
    return parsed.provider === 'google'
  } catch {
    return false
  }
}

export function buildAutoModelAttempts(input: AutoSelectionInput): AutoModelAttempt[] {
  const candidates = resolveRuleCandidates(input.kind, input.config)

  const attempts: AutoModelAttempt[] = []
  for (const candidate of candidates) {
    const modelRaw = candidate.model.trim()
    if (modelRaw.length === 0) continue

    const explicitOpenRouter = isCandidateOpenRouter(modelRaw)
    const requiredEnv = requiredEnvForCandidate(modelRaw)

    const shouldSkipForVideo =
      input.requiresVideoUnderstanding && (explicitOpenRouter || !isVideoUnderstandingCapable(modelRaw))
    if (shouldSkipForVideo) {
      continue
    }

    const addAttempt = (modelId: string, options: { openrouter: boolean; openrouterProviders: string[] | null }) => {
      const required = requiredEnvForCandidate(modelId)
      const hasKey = envHasKey(input.env, required)

      const catalog = input.catalog
      const maxIn = catalog ? resolveLiteLlmMaxInputTokensForModelId(catalog, options.openrouter ? modelId.slice('openrouter/'.length) : modelId) : null
      const promptTokens = input.promptTokens
      if (
        typeof promptTokens === 'number' &&
        Number.isFinite(promptTokens) &&
        typeof maxIn === 'number' &&
        Number.isFinite(maxIn) &&
        maxIn > 0 &&
        promptTokens > maxIn
      ) {
        return
      }

      const pricing = catalog
        ? resolveLiteLlmPricingForModelId(catalog, options.openrouter ? modelId.slice('openrouter/'.length) : modelId)
        : null
      const estimated = estimateCostUsd({
        pricing,
        promptTokens: input.promptTokens,
        outputTokens: input.desiredOutputTokens,
      })

      const userModelId = options.openrouter ? modelId : normalizeGatewayStyleModelId(modelId)
      const openrouterModelId = options.openrouter ? modelId.slice('openrouter/'.length).trim() : null
      const llmModelId = options.openrouter ? `openai/${openrouterModelId}` : normalizeGatewayStyleModelId(modelId)
      const debugParts = [
        `model=${options.openrouter ? `openrouter/${openrouterModelId}` : userModelId}`,
        `order=${attempts.length + 1}`,
        `key=${hasKey ? 'yes' : 'no'}(${required})`,
        `promptTok=${typeof input.promptTokens === 'number' ? input.promptTokens : 'unknown'}`,
        `maxIn=${typeof maxIn === 'number' ? maxIn : 'unknown'}`,
        `estUsd=${typeof estimated === 'number' ? estimated.toExponential(2) : 'unknown'}`,
      ]

      attempts.push({
        userModelId: options.openrouter ? `openrouter/${openrouterModelId}` : userModelId,
        llmModelId,
        openrouterProviders: options.openrouterProviders,
        forceOpenRouter: options.openrouter,
        requiredEnv: required,
        debug: debugParts.join(' '),
      })
    }

    if (explicitOpenRouter) {
      const providers = candidate.openrouterProviders?.length ? candidate.openrouterProviders : input.openrouterProvidersFromEnv
      addAttempt(modelRaw, { openrouter: true, openrouterProviders: providers })
      continue
    }

    addAttempt(modelRaw, { openrouter: false, openrouterProviders: input.openrouterProvidersFromEnv })

    const canAddOpenRouterFallback =
      !input.requiresVideoUnderstanding && envHasKey(input.env, 'OPENROUTER_API_KEY')
    if (canAddOpenRouterFallback) {
      const slug = normalizeGatewayStyleModelId(modelRaw)
      const providers = candidate.openrouterProviders?.length ? candidate.openrouterProviders : input.openrouterProvidersFromEnv
      addAttempt(`openrouter/${slug}`, { openrouter: true, openrouterProviders: providers })
    }
  }

  const seen = new Set<string>()
  const unique: AutoModelAttempt[] = []
  for (const a of attempts) {
    const key = `${a.forceOpenRouter ? 'or' : 'native'}:${a.userModelId}:${a.openrouterProviders?.join(',') ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(a)
  }
  return unique
}
