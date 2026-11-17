/**
 * State the gallery shares between its startup extension and the widget itself, plus the
 * Map Switcher hand-off reader both of them need. No esri imports (the extension module
 * that uses this can load where there is no map).
 *
 * The extension and the widget are separate webpack bundles, so a module-level variable
 * would be two different variables. The "which default has been applied to which map view"
 * record lives on window instead, keyed by widget id and JimuMapView id.
 */

// Map Switcher hand-off (Map Switcher 1.1.0+). When the user arrives from another app
// through Map Switcher, the basemap they had there is carried in one of these channels.
// A carried basemap wins over defaultBasemapId so the gallery's default does not
// overwrite it.
const MS_BASEMAP_PARAM = 'ms_basemap'
const MS_HANDOFF_KEY = 'ms-basemap-handoff'
const MS_CARRY_KEY = 'ms-basemap-carry'
const MS_MAX_AGE_MS = 120000
export const MS_ITEM_ID_PATTERN = /^[a-f0-9]{32}$/i

// Captured on module load, before Map Switcher cleans the address bar.
const msInitialSearch = typeof window !== 'undefined' && window.location ? (window.location.search || '') : ''

export function readMapSwitcherBasemap (): string | null {
  const fresh = (h: any): boolean => !!h?.value && Date.now() - Number(h.ts) < MS_MAX_AGE_MS
  try {
    const g = (window as any).__msBasemapHandoff
    if (g?.value) return String(g.value)
  } catch {}
  try {
    const v = new URLSearchParams(msInitialSearch || window.location?.search || '').get(MS_BASEMAP_PARAM)
    if (v) return v
  } catch {}
  try {
    const raw = window.sessionStorage.getItem(MS_HANDOFF_KEY)
    const h = raw ? JSON.parse(raw) : null
    if (fresh(h)) return String(h.value)
  } catch {}
  try {
    const raw = window.localStorage.getItem(MS_CARRY_KEY)
    const h = raw ? JSON.parse(raw) : null
    if (fresh(h)) return String(h.value)
  } catch {}
  return null
}

/** The portal item id inside a carried value ("item:<32 hex>"), or null. */
export function carriedItemId (carried: string | null): string | null {
  const id = carried?.startsWith('item:') ? carried.slice(5) : null
  return id && MS_ITEM_ID_PATTERN.test(id) ? id : null
}

const REGISTRY_KEY = '__bgcAppliedDefault'

function registry (): Record<string, string> {
  try {
    const w = window as any
    if (!w[REGISTRY_KEY] || typeof w[REGISTRY_KEY] !== 'object') w[REGISTRY_KEY] = {}
    return w[REGISTRY_KEY]
  } catch {
    return {}
  }
}

/**
 * What has been applied to this map view on behalf of this gallery: the default basemap
 * id, or "carried" when a Map Switcher basemap took its place. Undefined means nothing yet.
 */
export function getAppliedDefault (widgetId: string, viewId: string): string | undefined {
  return registry()[`${widgetId}|${viewId}`]
}

export function setAppliedDefault (widgetId: string, viewId: string, marker: string): void {
  registry()[`${widgetId}|${viewId}`] = marker
}

export function clearAppliedDefault (widgetId: string, viewId: string): void {
  delete registry()[`${widgetId}|${viewId}`]
}
