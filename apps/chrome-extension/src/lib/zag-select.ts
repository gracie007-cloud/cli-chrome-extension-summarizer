import {
  INIT_STATE,
  MachineStatus,
  createScope,
  type ActionsOrFn,
  type Bindable,
  type BindableContext,
  type BindableRefs,
  type ChooseFn,
  type ComputedFn,
  type EffectsOrFn,
  type EventObject,
  type GuardFn,
  type Machine,
  type MachineSchema,
  type Params,
  type Service,
} from '@zag-js/core'
import * as select from '@zag-js/select'
import { createNormalizer } from '@zag-js/types'
import { compact, ensure, isFunction, isString, toArray, warn } from '@zag-js/utils'

type Dict = Record<string, any>

const normalize = createNormalizer<{
  button: Dict
  element: Dict
  label: Dict
  select: Dict
}>((props) => props)

const propStore = new WeakMap<HTMLElement, Dict>()
const handlerStore = new WeakMap<HTMLElement, Map<string, EventListener>>()

function toEventName(key: string) {
  return key.slice(2).toLowerCase()
}

function setAttr(el: HTMLElement, key: string, value: unknown) {
  if (value === undefined || value === null) {
    el.removeAttribute(key)
    return
  }
  el.setAttribute(key, String(value))
}

export function applyProps(el: HTMLElement, props: Dict) {
  const prevProps = propStore.get(el) ?? {}
  const prevHandlers = handlerStore.get(el) ?? new Map<string, EventListener>()
  const nextHandlers = new Map<string, EventListener>()

  Object.keys(prevProps).forEach((key) => {
    if (!key.startsWith('on')) return
    const prev = prevProps[key]
    if (typeof prev !== 'function') return
    if (props[key] === prev) {
      nextHandlers.set(key, prevHandlers.get(key) ?? prev)
      return
    }
    const eventName = toEventName(key)
    el.removeEventListener(eventName, prev)
  })

  Object.entries(props).forEach(([key, value]) => {
    if (key === 'style' && value && typeof value === 'object') {
      Object.assign((el as HTMLElement).style, value)
      return
    }
    if (key === 'className') {
      el.className = value ?? ''
      return
    }
    if (key === 'htmlFor') {
      if (value === undefined || value === null) el.removeAttribute('for')
      else el.setAttribute('for', String(value))
      return
    }
    if (key.startsWith('on') && typeof value === 'function') {
      const eventName = toEventName(key)
      el.addEventListener(eventName, value as EventListener)
      nextHandlers.set(key, value as EventListener)
      return
    }
    if (key === 'disabled') {
      ;(el as HTMLButtonElement).disabled = Boolean(value)
      setAttr(el, key, value ? 'true' : undefined)
      return
    }
    if (key === 'hidden') {
      ;(el as HTMLElement).hidden = Boolean(value)
      return
    }
    if (key === 'readOnly') {
      ;(el as HTMLInputElement).readOnly = Boolean(value)
      return
    }
    if (key === 'required') {
      ;(el as HTMLInputElement).required = Boolean(value)
      setAttr(el, key, value ? 'true' : undefined)
      return
    }
    if (key === 'tabIndex') {
      ;(el as HTMLElement).tabIndex = Number(value)
      return
    }
    if (key === 'value') {
      ;(el as HTMLInputElement).value = value ?? ''
      return
    }
    if (key.startsWith('aria-') || key.startsWith('data-')) {
      setAttr(el, key, value)
      return
    }
    if (key in el && typeof value !== 'object') {
      try {
        ;(el as any)[key] = value
        return
      } catch {
        // fall through to setAttribute
      }
    }
    setAttr(el, key, value)
  })

  propStore.set(el, props)
  handlerStore.set(el, nextHandlers)
}

type Tracker = {
  deps: Array<() => unknown>
  values: unknown[]
  effect: VoidFunction
}

function createMachineService<T extends MachineSchema>(
  machine: Machine<T>,
  userProps: Partial<T['props']> = {}
): Service<T> & { subscribe: (fn: VoidFunction) => () => void } {
  const scope = createScope({ id: (userProps as any).id, ids: (userProps as any).ids })
  const props: any = machine.props?.({ props: compact(userProps), scope }) ?? userProps
  const prop = <K extends keyof T['props']>(key: K) => props[key]

  const listeners = new Set<VoidFunction>()
  const trackers: Tracker[] = []
  const cleanupFns: VoidFunction[] = []

  const notify = () => {
    trackers.forEach((tracker) => {
      const next = tracker.deps.map((fn) => fn())
      const changed =
        next.length !== tracker.values.length ||
        next.some((value, index) => value !== tracker.values[index])
      if (changed) {
        tracker.values = next
        tracker.effect()
      }
    })
    listeners.forEach((fn) => fn())
  }

  const bindable = <K>(params: () => any): Bindable<K> => {
    const initial = params().value ?? params().defaultValue
    let value = initial
    const ref = { current: initial }

    const get = () => {
      const next = params().value
      return next !== undefined ? next : value
    }

    const set = (nextValue: K | ((prev: K) => K)) => {
      const prev = get() as K
      const next = isFunction(nextValue) ? (nextValue as (prev: K) => K)(prev) : nextValue
      const controlled = params().value !== undefined
      if (!controlled) {
        value = next
        ref.current = next
      }
      const isEqual = params().isEqual ?? Object.is
      if (!isEqual(next, prev)) params().onChange?.(next, prev)
      notify()
    }

    return {
      initial,
      ref,
      get,
      set,
      invoke(nextValue, prevValue) {
        params().onChange?.(nextValue, prevValue)
        notify()
      },
      hash(next) {
        return params().hash?.(next) ?? String(next)
      },
    }
  }

  bindable.cleanup = (fn: VoidFunction) => {
    cleanupFns.push(fn)
  }
  bindable.ref = <K>(defaultValue: K) => {
    let current = defaultValue
    return {
      get: () => current,
      set: (next: K) => {
        current = next
      },
    }
  }

  const eventRef: { current: EventObject } = { current: { type: '' } }
  const previousEventRef: { current: EventObject | null } = { current: null }

  const getEvent = () => ({
    ...eventRef.current,
    current: () => eventRef.current,
    previous: () => previousEventRef.current,
  })

  let ctx: BindableContext<T>
  let computed: ComputedFn<T>
  let refs: BindableRefs<T>

  const context = machine.context?.({
    prop,
    bindable,
    scope,
    flush: (fn) => queueMicrotask(fn),
    getContext() {
      return ctx
    },
    getComputed() {
      return computed
    },
    getRefs() {
      return refs
    },
    getEvent,
  })

  ctx = {
    get(key) {
      return context?.[key].get()
    },
    set(key, value) {
      context?.[key].set(value)
    },
    initial(key) {
      return context?.[key].initial
    },
    hash(key) {
      const current = context?.[key].get()
      return context?.[key].hash(current)
    },
  } as BindableContext<T>

  refs = (() => {
    const initial = machine.refs?.({ prop, context: ctx }) ?? {}
    const store = { ...initial } as any
    return {
      get(key) {
        return store[key]
      },
      set(key, value) {
        store[key] = value
      },
    } as BindableRefs<T>
  })()

  const effects = new Map<string, VoidFunction>()
  let transitionRef: any = null
  let status = MachineStatus.NotStarted

  const computedFn: ComputedFn<T> = (key) => {
    ensure(machine.computed, () => `[zag-js] No computed object found on machine`)
    const fn = machine.computed[key]
    return fn({
      context: ctx,
      event: getEvent(),
      prop,
      refs,
      scope,
      computed: computedFn,
    })
  }
  computed = computedFn

  const getState = () => ({
    ...state,
    matches: (...values: T['state'][]) => values.includes(state.get() as T['state']),
    hasTag: (tag: T['tag']) =>
      !!machine.states[state.get() as T['state']]?.tags?.includes(tag),
  })

  const action = (keys: ActionsOrFn<T> | undefined) => {
    const strs = isFunction(keys) ? keys(getParams()) : keys
    if (!strs) return
    const fns = strs.map((s) => {
      const fn = machine.implementations?.actions?.[s]
      if (!fn) warn(`[zag-js] No implementation found for action "${JSON.stringify(s)}"`)
      return fn
    })
    fns.forEach((fn) => fn?.(getParams()))
  }

  const guard = (str: T['guard'] | GuardFn<T>) => {
    if (isFunction(str)) return str(getParams())
    return machine.implementations?.guards?.[str]?.(getParams())
  }

  const effect = (keys: EffectsOrFn<T> | undefined) => {
    const strs = isFunction(keys) ? keys(getParams()) : keys
    if (!strs) return
    const fns = strs.map((s) => {
      const fn = machine.implementations?.effects?.[s]
      if (!fn) warn(`[zag-js] No implementation found for effect "${JSON.stringify(s)}"`)
      return fn
    })
    const cleanups: VoidFunction[] = []
    fns.forEach((fn) => {
      const cleanup = fn?.(getParams())
      if (cleanup) cleanups.push(cleanup)
    })
    return () => cleanups.forEach((fn) => fn?.())
  }

  const choose: ChooseFn<T> = (transitions) => {
    return toArray(transitions).find((t) => {
      let result = !t.guard
      if (isString(t.guard)) result = !!guard(t.guard)
      else if (isFunction(t.guard)) result = t.guard(getParams())
      return result
    })
  }

  const track = (deps: Array<() => unknown>, effectFn: VoidFunction) => {
    trackers.push({ deps, values: deps.map((fn) => fn()), effect: effectFn })
  }

  const getParams = (): Params<T> => ({
    state: getState(),
    context: ctx,
    event: getEvent(),
    prop,
    send,
    action,
    guard,
    track,
    refs,
    computed: computedFn,
    flush: (fn) => queueMicrotask(fn),
    scope,
    choose,
  })

  const state = bindable(() => ({
    defaultValue: machine.initialState({ prop }),
    onChange(nextState: string, prevState: string | undefined) {
      if (prevState) {
        const exitEffects = effects.get(prevState)
        exitEffects?.()
        effects.delete(prevState)
      }
      if (prevState) action(machine.states[prevState]?.exit)

      action(transitionRef?.actions)

      const cleanup = effect(machine.states[nextState]?.effects)
      if (cleanup) effects.set(nextState, cleanup)

      if (prevState === INIT_STATE) {
        action(machine.entry)
        const rootCleanup = effect(machine.effects)
        if (rootCleanup) effects.set(INIT_STATE, rootCleanup)
      }

      action(machine.states[nextState]?.entry)
    },
  }))

  const send = (event: EventObject) => {
    queueMicrotask(() => {
      if (status !== MachineStatus.Started) return
      previousEventRef.current = eventRef.current
      eventRef.current = event

      const currentState = state.get() as string
      const transitions = machine.states[currentState]?.on?.[event.type] ?? machine.on?.[event.type]
      const transition = choose(transitions)
      if (!transition) return

      transitionRef = transition
      const target = transition.target ?? currentState
      const changed = target !== currentState

      if (changed) {
        state.set(target)
      } else if (transition.reenter && !changed) {
        state.invoke(currentState, currentState)
      } else {
        action(transition.actions ?? [])
      }
    })
  }

  machine.watch?.(getParams())

  queueMicrotask(() => {
    status = MachineStatus.Started
    state.invoke(state.initial as string, INIT_STATE)
  })

  return {
    state: getState(),
    send,
    context: ctx,
    prop,
    scope,
    refs,
    computed: computedFn,
    event: getEvent(),
    getStatus: () => status,
    subscribe(fn: VoidFunction) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    destroy() {
      cleanupFns.forEach((fn) => fn())
      effects.forEach((fn) => fn?.())
      effects.clear()
    },
  } as Service<T> & { subscribe: (fn: VoidFunction) => () => void }
}

export type ZagSelectItem = {
  label: string
  value: string
  disabled?: boolean
}

export type ZagSelectElements = {
  root: HTMLElement
  label: HTMLElement
  trigger: HTMLButtonElement
  positioner: HTMLElement
  content: HTMLElement
  list: HTMLElement
  hiddenSelect: HTMLSelectElement
  valueText: HTMLElement
  items: Map<string, HTMLElement>
}

export function createZagSelect(opts: {
  id: string
  items: ZagSelectItem[]
  elements: ZagSelectElements
  value?: string
  onValueChange?: (value: string) => void
  renderValue?: (value: string, api: select.Api) => void
}) {
  const syncHiddenOptions = () => {
    const selectEl = opts.elements.hiddenSelect
    selectEl.innerHTML = ''
    opts.items.forEach((item) => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      option.disabled = Boolean(item.disabled)
      selectEl.append(option)
    })
  }

  syncHiddenOptions()

  const collection = select.collection({
    items: opts.items,
    itemToValue: (item) => item.value,
    itemToString: (item) => item.label,
    isItemDisabled: (item) => Boolean(item.disabled),
  })

  const service = createMachineService(select.machine, {
    id: opts.id,
    collection,
    positioning: { placement: 'bottom-start', gutter: 6, sameWidth: true },
    defaultValue: opts.value ? [opts.value] : [],
    onValueChange: ({ value }: select.ValueChangeDetails) => {
      opts.onValueChange?.(value[0] ?? '')
    },
  })

  const api = select.connect(service, normalize)

  const render = () => {
    applyProps(opts.elements.root, api.getRootProps())
    applyProps(opts.elements.label, api.getLabelProps())
    applyProps(opts.elements.trigger, api.getTriggerProps())
    applyProps(opts.elements.positioner, api.getPositionerProps())
    applyProps(opts.elements.content, api.getContentProps())
    applyProps(opts.elements.list, api.getListProps())
    applyProps(opts.elements.hiddenSelect, api.getHiddenSelectProps())
    opts.items.forEach((item) => {
      const el = opts.elements.items.get(item.value)
      if (!el) return
      applyProps(el, api.getItemProps({ item }))
    })
    const value = api.value[0] ?? ''
    opts.elements.valueText.textContent = api.valueAsString || opts.items[0]?.label || ''
    opts.renderValue?.(value, api)
  }

  render()
  service.subscribe(render)

  return {
    api,
    service,
    setValue(value: string) {
      api.setValue(value ? [value] : [])
    },
  }
}
