/**
 * Applies the gallery's default basemap when the app loads, whether or not the gallery
 * widget is ever opened.
 *
 * A widget inside a Widget Controller or a closed sidebar is not rendered until the user
 * opens it, so the widget's own "apply the default on load" code only ran at that point.
 * This module is an APP_CONFIG_PROCESSOR extension (manifest.json `extensions`). Jimu
 * loads every widget manifest when the app config loads and runs these extensions right
 * after, for every widget in the app, opened or not (jimu-core ConfigManager:
 * loadAllWidgetsManifest, then applyAppConfigProcessorExtension).
 *
 * `process()` returns the app config untouched and starts a small background watcher that
 * preloads the default basemap, waits for the configured map widget's views, then applies
 * the default (or the basemap
 * Map Switcher carried in) once per view. It records what it applied in the window
 * registry from startupState.ts, so the widget, when it is opened later, sees the default
 * is done and leaves whatever basemap the user has since picked alone.
 *
 * Jimu runs only the FIRST registered APP_CONFIG_PROCESSOR (ExtensionManager keeps one
 * per point; ConfigManager calls getExtensions(...)[0]). An app with the gallery on its
 * Large, Medium and Small layouts has three gallery widgets, but only one of them gets
 * this call. So the one instance that runs handles every copy of the gallery in the app:
 * per map widget it picks the copy that belongs to the current screen size (the layout
 * that holds it, owned by a page or widget for that size mode) and applies that copy's
 * default under that copy's widget id.
 *
 * No static esri imports: this module can also be loaded where there is no map. The Maps
 * SDK classes come from loadArcGISJSAPIModules at the moment a view exists. Every path is
 * guarded; nothing here may throw into app startup.
 */
import { getAppStore } from 'jimu-core'
import { MapViewManager, loadArcGISJSAPIModules } from 'jimu-arcgis'
import { type BasemapItem, basemapKey, isUrlBasemap } from '../runtime/basemapSource'
import { BASEMAP_MODULE_IDS, buildBasemap, modulesFromList } from '../runtime/basemapBuild'
import { carriedItemId, clearAppliedDefault, getAppliedDefault, readMapSwitcherBasemap, setAppliedDefault } from '../runtime/startupState'

/** How often to look for the map widget's views, and for how long. */
export const POLL_MS = 300
export const GIVE_UP_MS = 90000
/** One retry after a failed load (a secured service can answer before sign-in is ready). */
export const RETRY_MS = 3000

const SIZE_MODES = ['LARGE', 'MEDIUM', 'SMALL']

function plainArray (value: any): any[] {
  if (!value) return []
  if (typeof value.asMutable === 'function') return value.asMutable({ deep: true })
  return Array.isArray(value) ? value : Array.from(value)
}

function plain (value: any): any {
  return value && typeof value.asMutable === 'function' ? value.asMutable({ deep: true }) : value
}

/**
 * Which size modes show each layout. Pages, widgets (controllers, sidebars, map fixed
 * layouts), sections' views, dialogs, header and footer own layouts per size mode. A size
 * mode an owner leaves out falls back to the main size mode's layout, as Jimu does.
 */
export function layoutSizeModes (appConfig: any): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const main: string = appConfig?.mainSizeMode || 'LARGE'
  const add = (byMode: any) => {
    if (!byMode || typeof byMode !== 'object') return
    for (const mode of SIZE_MODES) {
      const layoutId = byMode[mode] || byMode[main]
      if (typeof layoutId !== 'string') continue
      if (!out[layoutId]) out[layoutId] = []
      if (!out[layoutId].includes(mode)) out[layoutId].push(mode)
    }
  }
  const owners = (group: any) => Object.values(group || {}) as any[]
  for (const page of owners(appConfig?.pages)) add(page?.layout)
  for (const view of owners(appConfig?.views)) add(view?.layout)
  for (const dialog of owners(appConfig?.dialogs)) add(dialog?.layout)
  add(appConfig?.header?.layout)
  add(appConfig?.footer?.layout)
  for (const widget of owners(appConfig?.widgets)) {
    for (const byMode of owners(widget?.layouts)) add(byMode)
  }
  return out
}

/** Size modes a widget shows in: the modes of every layout that holds it (and does not hide it there). */
export function widgetSizeModes (appConfig: any, widgetId: string, modesByLayout = layoutSizeModes(appConfig)): string[] {
  const modes: string[] = []
  for (const [layoutId, layout] of Object.entries(appConfig?.layouts || {}) as Array<[string, any]>) {
    const holds = Object.values(layout?.content || {}).some((item: any) => item?.widgetId === widgetId && !item?.isPending)
    if (!holds) continue
    for (const mode of modesByLayout[layoutId] || []) if (!modes.includes(mode)) modes.push(mode)
  }
  return modes
}

/** The copy for this screen size; else the main size mode's copy; else the first. */
export function pickCopy (copies: Array<{ widgetId: string, modes: string[] }>, sizeMode: string, mainSizeMode: string): string | undefined {
  return (copies.find(c => c.modes.includes(sizeMode)) ||
    copies.find(c => c.modes.includes(mainSizeMode)) ||
    copies[0])?.widgetId
}

interface Plan {
  widgetId: string
  target: BasemapItem | undefined
  marker: string
  portalUrl?: string
}

/** Hide a basemap's layers until the gallery's basemap replaces it; returns what to show again. */
function hideBasemap (basemap: any): any[] {
  const hidden: any[] = []
  try {
    for (const group of [basemap?.baseLayers, basemap?.referenceLayers]) {
      group?.forEach?.((layer: any) => {
        if (layer && layer.visible !== false) { layer.visible = false; hidden.push(layer) }
      })
    }
  } catch {}
  return hidden
}

function showLayers (layers: any[]): void {
  layers.forEach(layer => { try { layer.visible = true } catch {} })
}

export default class ApplyDefaultBasemapExtension {
  /** Set by Jimu after construction: `${widgetId}-${extension name}` */
  id: string
  widgetId: string
  private stopped = false
  private timer: any = null
  private unsubscribe: (() => void) | null = null
  private retryTimers: any[] = []
  private handled: Record<string, boolean> = {}
  private modules: Promise<any> | null = null
  /** Basemaps built and loaded at app start, before the map exists, keyed by gallery widget id. Each is used once. */
  private preloaded: Record<string, Promise<any>> = {}
  retryMs = RETRY_MS

  async process (appConfig: any): Promise<any> {
    try {
      this.start(appConfig)
    } catch {
      // Never block or break app startup
    }
    return appConfig
  }

  destroy (): void {
    this.stopped = true
    this.stopWatching()
    this.retryTimers.forEach(t => clearTimeout(t))
    this.retryTimers = []
  }

  private stopWatching (): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    try { this.unsubscribe?.() } catch {}
    this.unsubscribe = null
  }

  private start (rawConfig: any): void {
    const appConfig = plain(rawConfig)
    const own = appConfig?.widgets?.[this.widgetId]
    if (!own) return
    const mainSizeMode: string = appConfig.mainSizeMode || 'LARGE'
    const modesByLayout = layoutSizeModes(appConfig)

    // Every copy of the gallery in this app, grouped by the map widget it drives
    const groups: Record<string, Array<{ widgetId: string, modes: string[] }>> = {}
    for (const [widgetId, widget] of Object.entries(appConfig.widgets || {}) as Array<[string, any]>) {
      if (widget?.uri !== own.uri) continue
      const mapWidgetId: string = widget?.useMapWidgetIds?.[0]
      if (!mapWidgetId) continue
      if (!groups[mapWidgetId]) groups[mapWidgetId] = []
      groups[mapWidgetId].push({ widgetId, modes: widgetSizeModes(appConfig, widgetId, modesByLayout) })
    }
    const mapWidgetIds = Object.keys(groups)
    if (!mapWidgetIds.length) return

    const carried = readMapSwitcherBasemap()
    const planFor = (widgetId: string): Plan | null => {
      const config = appConfig.widgets[widgetId]?.config || {}
      const basemaps: BasemapItem[] = plainArray(config.basemaps)
      const defaultId: string = config.defaultBasemapId || null
      // Same priority as the widget: a basemap carried in by Map Switcher wins over the
      // default. If it is in this gallery, apply it; if not, leave the map to Map Switcher.
      if (carried) {
        const id = carriedItemId(carried)
        return { widgetId, target: id ? basemaps.find(b => b.id === id) : undefined, marker: defaultId || 'carried', portalUrl: config.portalUrl }
      }
      const target = defaultId ? basemaps.find(b => b.id === defaultId) : undefined
      return target ? { widgetId, target, marker: target.id, portalUrl: config.portalUrl } : null
    }
    const sizeMode = (): string => {
      try { return getAppStore().getState().browserSizeMode || mainSizeMode } catch { return mainSizeMode }
    }

    // Start loading the basemap now, while the map widget is still starting, so it is ready
    // the moment the map view exists and the web map's own basemap never gets to draw.
    for (const mapWidgetId of mapWidgetIds) {
      const widgetId = pickCopy(groups[mapWidgetId], sizeMode(), mainSizeMode)
      const plan = widgetId ? planFor(widgetId) : null
      if (plan?.target && !this.preloaded[widgetId]) {
        const pending = this.makeBasemap(plan)
        pending.catch(() => {})
        this.preloaded[widgetId] = pending
      }
    }

    const startedAt = Date.now()
    const scan = () => {
      if (this.stopped) return
      try {
        const views: any[] = MapViewManager.getInstance().getAllJimuMapViews?.() || []
        for (const jmv of views) {
          if (!jmv || this.handled[jmv.id] || !groups[jmv.mapWidgetId]) continue
          this.handled[jmv.id] = true
          // The screen size is read when the view shows up, so the store has it by then
          const widgetId = pickCopy(groups[jmv.mapWidgetId], sizeMode(), mainSizeMode)
          const plan = widgetId ? planFor(widgetId) : null
          if (plan) void this.applyToView(jmv, plan)
        }
      } catch {
        // Map views not available yet
      }
    }
    // A new map view is announced through the store (jimuMapViewsInfo), so react to store
    // changes right away; the timer is the fallback.
    try { this.unsubscribe = getAppStore().subscribe(scan) } catch {}
    const tick = () => {
      this.timer = null
      if (this.stopped) return
      scan()
      if (Date.now() - startedAt < GIVE_UP_MS) this.timer = setTimeout(tick, POLL_MS)
      else this.stopWatching()
    }
    tick()
  }

  private loadModules (): Promise<any> {
    if (!this.modules) {
      this.modules = loadArcGISJSAPIModules(BASEMAP_MODULE_IDS).then(modulesFromList)
      this.modules.catch(() => { this.modules = null })
    }
    return this.modules
  }

  /** A new, loaded Basemap for this plan. */
  private async makeBasemap (plan: Plan): Promise<any> {
    const mods = await this.loadModules()
    const portal = new mods.Portal({ url: plan.portalUrl || 'https://www.arcgis.com' })
    const basemap = await buildBasemap(mods, plan.target, portal)
    await (isUrlBasemap(plan.target) ? basemap.loadAll() : basemap.load())
    return basemap
  }

  /** The preloaded basemap for this copy if there is one (once), else a new one. */
  private takeBasemap (plan: Plan): Promise<any> {
    const pending = this.preloaded[plan.widgetId]
    if (pending) {
      delete this.preloaded[plan.widgetId]
      return pending
    }
    return this.makeBasemap(plan)
  }

  private async applyToView (jmv: any, plan: Plan, retry = true): Promise<void> {
    const viewId: string = jmv.id
    const { widgetId, target, marker } = plan
    // The widget got there first (it was open at startup): nothing to do
    if (retry && getAppliedDefault(widgetId, viewId)) return
    // Claim the view before any await so an opening widget does not apply it a second time
    setAppliedDefault(widgetId, viewId, marker)
    if (!target) return // carried basemap not in this gallery: Map Switcher applies it

    let hidden: any[] = []
    try {
      // Act as soon as the view exists, not when it has finished loading: waiting for
      // whenJimuMapViewLoaded let the web map's basemap draw first and then switch.
      const view = jmv.view
      const map = view?.map
      if (!map) throw new Error('no map')
      // The web map sets its own basemap while it loads; set ours after that
      if (map.loaded === false && typeof map.load === 'function') await map.load()
      if (this.stopped) return
      if (basemapKey(map.basemap) === target.id) return

      const original = map.basemap
      const pending = this.takeBasemap(plan)
      // Keep the web map's basemap from drawing while ours finishes loading
      hidden = hideBasemap(original)
      const basemap = await pending
      if (this.stopped || getAppliedDefault(widgetId, viewId) !== marker) { showLayers(hidden); return }
      map.basemap = basemap

      // If the web map put its own basemap back while finishing, set ours again once
      if (typeof view.when === 'function') {
        await view.when()
        if (!this.stopped && getAppliedDefault(widgetId, viewId) === marker && map.basemap === original) {
          map.basemap = basemap
        }
      }
    } catch (error) {
      showLayers(hidden)
      noteFailure(widgetId, viewId, target, error)
      if (this.stopped || getAppliedDefault(widgetId, viewId) !== marker) return
      if (retry) {
        this.retryTimers.push(setTimeout(() => { void this.applyToView(jmv, plan, false) }, this.retryMs))
        return
      }
      // Let the widget try again when it is opened
      clearAppliedDefault(widgetId, viewId)
    }
  }
}

/** Why a startup apply failed, for the console: window.__bgcAppliedDefaultErrors */
function noteFailure (widgetId: string, viewId: string, target: BasemapItem, error: any): void {
  try {
    const w = window as any
    if (!Array.isArray(w.__bgcAppliedDefaultErrors)) w.__bgcAppliedDefaultErrors = []
    w.__bgcAppliedDefaultErrors.push({ widgetId, viewId, basemap: target.id, message: String(error?.message || error) })
  } catch {}
}
