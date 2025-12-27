import { readPresetOrCustomValue, resolvePresetOrCustom } from '../../lib/combo'
import { defaultSettings, loadSettings, saveSettings } from '../../lib/settings'
import { applyTheme, type ColorMode, type ColorScheme } from '../../lib/theme'
import { createZagSelect, type ZagSelectItem } from '../../lib/zag-select'

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id}`)
  return el as T
}

const formEl = byId<HTMLFormElement>('form')
const statusEl = byId<HTMLSpanElement>('status')

const tokenEl = byId<HTMLInputElement>('token')
const modelEl = byId<HTMLInputElement>('model')
const modelPresetsEl = byId<HTMLDataListElement>('modelPresets')
const languagePresetEl = byId<HTMLSelectElement>('languagePreset')
const languageCustomEl = byId<HTMLInputElement>('languageCustom')
const promptOverrideEl = byId<HTMLTextAreaElement>('promptOverride')
const autoEl = byId<HTMLInputElement>('auto')
const maxCharsEl = byId<HTMLInputElement>('maxChars')
const schemeLabelEl = byId<HTMLLabelElement>('schemeLabel')
const schemePickerEl = byId<HTMLElement>('schemePicker')
const schemeTriggerEl = byId<HTMLButtonElement>('schemeTrigger')
const schemeValueEl = byId<HTMLSpanElement>('schemeValue')
const schemeChipsEl = byId<HTMLSpanElement>('schemeChips')
const schemePositionerEl = byId<HTMLDivElement>('schemePositioner')
const schemeContentEl = byId<HTMLDivElement>('schemeContent')
const schemeListEl = byId<HTMLDivElement>('schemeList')
const schemeHiddenEl = byId<HTMLSelectElement>('schemeHidden')
const modeLabelEl = byId<HTMLLabelElement>('modeLabel')
const modePickerEl = byId<HTMLElement>('modePicker')
const modeTriggerEl = byId<HTMLButtonElement>('modeTrigger')
const modeValueEl = byId<HTMLSpanElement>('modeValue')
const modePositionerEl = byId<HTMLDivElement>('modePositioner')
const modeContentEl = byId<HTMLDivElement>('modeContent')
const modeListEl = byId<HTMLDivElement>('modeList')
const modeHiddenEl = byId<HTMLSelectElement>('modeHidden')
const fontFamilyEl = byId<HTMLInputElement>('fontFamily')
const fontSizeEl = byId<HTMLInputElement>('fontSize')

const setStatus = (text: string) => {
  statusEl.textContent = text
}

async function refreshModelPresets(token: string) {
  const trimmed = token.trim()
  if (!trimmed) return
  try {
    const res = await fetch('http://127.0.0.1:8787/v1/models', {
      headers: { Authorization: `Bearer ${trimmed}` },
    })
    if (!res.ok) return
    const json = (await res.json()) as unknown
    if (!json || typeof json !== 'object') return
    const obj = json as Record<string, unknown>
    if (obj.ok !== true) return
    const optionsRaw = obj.options
    if (!Array.isArray(optionsRaw)) return

    const options = optionsRaw
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const record = item as { id?: unknown; label?: unknown }
        const id = typeof record.id === 'string' ? record.id.trim() : ''
        const label = typeof record.label === 'string' ? record.label.trim() : ''
        if (!id) return null
        return { id, label }
      })
      .filter((x): x is { id: string; label: string } => x !== null)

    if (options.length === 0) return

    modelPresetsEl.innerHTML = ''
    for (const opt of options) {
      const el = document.createElement('option')
      el.value = opt.id
      if (opt.label) el.label = opt.label
      modelPresetsEl.append(el)
    }
  } catch {
    // ignore
  }
}

const languagePresets = [
  'auto',
  'en',
  'de',
  'es',
  'fr',
  'it',
  'pt',
  'nl',
  'sv',
  'no',
  'da',
  'fi',
  'pl',
  'cs',
  'tr',
  'ru',
  'uk',
  'ar',
  'hi',
  'ja',
  'ko',
  'zh-cn',
  'zh-tw',
]

const schemeLabels: Record<ColorScheme, string> = {
  slate: 'Slate',
  cedar: 'Cedar',
  mint: 'Mint',
  ocean: 'Ocean',
  ember: 'Ember',
  iris: 'Iris',
}

const modeLabels: Record<ColorMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
}

function buildItemMap(listEl: HTMLElement) {
  const items = new Map<string, HTMLElement>()
  listEl.querySelectorAll<HTMLElement>('.pickerOption').forEach((el) => {
    const value = el.dataset.value
    if (value) items.set(value, el)
  })
  return items
}

const schemeItems: ZagSelectItem[] = Object.entries(schemeLabels).map(([value, label]) => ({
  value,
  label,
}))
const modeItems: ZagSelectItem[] = Object.entries(modeLabels).map(([value, label]) => ({
  value,
  label,
}))

const schemeItemEls = buildItemMap(schemeListEl)
const modeItemEls = buildItemMap(modeListEl)

let currentScheme: ColorScheme = defaultSettings.colorScheme
let currentMode: ColorMode = defaultSettings.colorMode
let syncingScheme = false
let syncingMode = false

const schemePicker = createZagSelect({
  id: 'options-scheme',
  items: schemeItems,
  value: defaultSettings.colorScheme,
  elements: {
    root: schemePickerEl,
    label: schemeLabelEl,
    trigger: schemeTriggerEl,
    positioner: schemePositionerEl,
    content: schemeContentEl,
    list: schemeListEl,
    hiddenSelect: schemeHiddenEl,
    valueText: schemeValueEl,
    items: schemeItemEls,
  },
  renderValue: (value) => {
    const scheme = (value || defaultSettings.colorScheme) as ColorScheme
    schemeChipsEl.className = `scheme-chips scheme-${scheme}`
  },
  onValueChange: (value) => {
    if (syncingScheme) return
    if (!value) return
    currentScheme = value as ColorScheme
    applyTheme({ scheme: currentScheme, mode: currentMode })
  },
})

const modePicker = createZagSelect({
  id: 'options-mode',
  items: modeItems,
  value: defaultSettings.colorMode,
  elements: {
    root: modePickerEl,
    label: modeLabelEl,
    trigger: modeTriggerEl,
    positioner: modePositionerEl,
    content: modeContentEl,
    list: modeListEl,
    hiddenSelect: modeHiddenEl,
    valueText: modeValueEl,
    items: modeItemEls,
  },
  onValueChange: (value) => {
    if (syncingMode) return
    if (!value) return
    currentMode = value as ColorMode
    applyTheme({ scheme: currentScheme, mode: currentMode })
  },
})

async function load() {
  const s = await loadSettings()
  tokenEl.value = s.token
  modelEl.value = s.model
  await refreshModelPresets(s.token)
  {
    const resolved = resolvePresetOrCustom({ value: s.language, presets: languagePresets })
    languagePresetEl.value = resolved.presetValue
    languageCustomEl.hidden = !resolved.isCustom
    languageCustomEl.value = resolved.customValue
  }
  promptOverrideEl.value = s.promptOverride
  autoEl.checked = s.autoSummarize
  maxCharsEl.value = String(s.maxChars)
  fontFamilyEl.value = s.fontFamily
  fontSizeEl.value = String(s.fontSize)
  currentScheme = s.colorScheme
  currentMode = s.colorMode
  syncingScheme = true
  schemePicker.setValue(s.colorScheme)
  queueMicrotask(() => {
    syncingScheme = false
  })
  syncingMode = true
  modePicker.setValue(s.colorMode)
  queueMicrotask(() => {
    syncingMode = false
  })
  applyTheme({ scheme: s.colorScheme, mode: s.colorMode })
}

languagePresetEl.addEventListener('change', () => {
  languageCustomEl.hidden = languagePresetEl.value !== 'custom'
  if (!languageCustomEl.hidden) languageCustomEl.focus()
})

formEl.addEventListener('submit', (e) => {
  e.preventDefault()
  void (async () => {
    setStatus('Saving…')
    const current = await loadSettings()
    await saveSettings({
      token: tokenEl.value || defaultSettings.token,
      model: modelEl.value || defaultSettings.model,
      length: current.length,
      language: readPresetOrCustomValue({
        presetValue: languagePresetEl.value,
        customValue: languageCustomEl.value,
        defaultValue: defaultSettings.language,
      }),
      promptOverride: promptOverrideEl.value || defaultSettings.promptOverride,
      autoSummarize: autoEl.checked,
      maxChars: Number(maxCharsEl.value) || defaultSettings.maxChars,
      colorScheme: currentScheme || defaultSettings.colorScheme,
      colorMode: currentMode || defaultSettings.colorMode,
      fontFamily: fontFamilyEl.value || defaultSettings.fontFamily,
      fontSize: Number(fontSizeEl.value) || defaultSettings.fontSize,
    })
    setStatus('Saved')
    setTimeout(() => setStatus(''), 900)
  })()
})

void load()
