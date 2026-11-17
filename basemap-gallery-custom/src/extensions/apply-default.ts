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
 * waits for the configured map widget's views, then applies the default (or the basemap
 * Map Switcher carried in) once per view. It records what it applied in the window
 * registry from startupState.ts, so the widget, when it is opened later, sees the default
 * is done and leaves whatever basemap the user has since picked alone.
 *
 * No static esri imports: this module can also be loaded where there is no map. The Maps
 * SDK classes come from loadArcGISJSAPIModules at the moment a view exists. Every path is
 * guarded; nothing here may throw into app startup.
 */
import { MapViewManager, loadArcGISJSAPIModules } from 'jimu-arcgis'
import { type BasemapItem, basemapKey, isUrlBasemap } from '../runtime/basemapSource'
import { BASEMAP_MODULE_IDS, buildBasemap, modulesFromList } from '../runtime/basemapBuild'
import { carriedItemId, clearAppliedDefault, getAppliedDefault, readMapSwitcherBasemap, setAppliedDefault } from '../runtime/startupState'

/** How often to look for the map widget's views, and for how long. */
export const POLL_MS = 300
export const GIVE_UP_MS = 90000

function plainArray (value: any): any[] {
  if (!value) return []
  if (typeof value.asMutable === 'function') return value.asMutable({ deep: true })
  return Array.isArray(value) ? value : Array.from(value)
}

export default class ApplyDefaultBasemapExtension {
  id = 'apply-default-basemap'
  widgetId: string
  private stopped = false
  private timer: any = null
  private handled: Record<string, boolean> = {}

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
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private start (appConfig: any): void {
    const widgetJson = appConfig?.widgets?.[this.widgetId]
    const mapWidgetId: string = widgetJson?.useMapWidgetIds?.[0]
    if (!widgetJson || !mapWidgetId) return
    const config = widgetJson.config || {}
    const basemaps: BasemapItem[] = plainArray(config.basemaps)
    const defaultId: string = config.defaultBasemapId || null

    // Same priority as the widget: a basemap carried in by Map Switcher wins over the
    // default. If it is in this gallery, apply it; if not, leave the map to Map Switcher.
    const carried = readMapSwitcherBasemap()
    let target: BasemapItem | undefined
    let marker: string
    if (carried) {
      const id = carriedItemId(carried)
      target = id ? basemaps.find(b => b.id === id) : undefined
      marker = defaultId || 'carried'
    } else {
      target = defaultId ? basemaps.find(b => b.id === defaultId) : undefined
      marker = target?.id
    }
    if (!marker) return

    const startedAt = Date.now()
    const tick = () => {
      this.timer = null
      if (this.stopped) return
      try {
        const views: any[] = MapViewManager.getInstance().getAllJimuMapViews?.() || []
        views
          .filter(jmv => jmv && jmv.mapWidgetId === mapWidgetId && !this.handled[jmv.id])
          .forEach(jmv => {
            this.handled[jmv.id] = true
            void this.applyToView(jmv, target, marker, config.portalUrl)
          })
      } catch {
        // Map views not available yet in this frame
      }
      if (Date.now() - startedAt < GIVE_UP_MS) {
        this.timer = setTimeout(tick, POLL_MS)
      }
    }
    tick()
  }

  private async applyToView (jmv: any, target: BasemapItem | undefined, marker: string, portalUrl?: string): Promise<void> {
    const viewId: string = jmv.id
    // The widget got there first (it was open at startup): nothing to do
    if (getAppliedDefault(this.widgetId, viewId)) return
    // Claim the view before any await so an opening widget does not apply it a second time
    setAppliedDefault(this.widgetId, viewId, marker)
    if (!target) return // carried basemap not in this gallery: Map Switcher applies it

    try {
      if (typeof jmv.whenJimuMapViewLoaded === 'function') await jmv.whenJimuMapViewLoaded()
      const view = jmv.view
      if (!view) throw new Error('no view')
      if (typeof view.when === 'function') await view.when()
      if (this.stopped) return
      if (basemapKey(view.map?.basemap) === target.id) return

      const mods = modulesFromList(await loadArcGISJSAPIModules(BASEMAP_MODULE_IDS))
      const portal = new mods.Portal({ url: portalUrl || 'https://www.arcgis.com' })
      const basemap = await buildBasemap(mods, target, portal)
      await (isUrlBasemap(target) ? basemap.loadAll() : basemap.load())
      if (this.stopped || getAppliedDefault(this.widgetId, viewId) !== marker) return
      view.map.basemap = basemap
    } catch {
      // Let the widget try again when it is opened
      if (getAppliedDefault(this.widgetId, viewId) === marker) clearAppliedDefault(this.widgetId, viewId)
    }
  }
}
