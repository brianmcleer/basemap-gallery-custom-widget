/**
 * Basemap sources: portal items and service URLs.
 *
 * Pure helpers shared by the runtime and the settings panel. This file must stay free of
 * esri imports: the settings bundle loads in the Builder, which has no map, and a static
 * esri import there fails the whole settings panel (playbook Section 12, item 1).
 */

/** Layer class used for a basemap added by URL. `auto` is resolved from the service. */
export type UrlLayerType =
  | 'auto'
  | 'tile'
  | 'map-image'
  | 'vector-tile'
  | 'imagery'
  | 'imagery-tile'
  | 'wms'
  | 'wmts'

/** Concrete layer types, in the order the settings panel lists them. */
export const URL_LAYER_TYPES: UrlLayerType[] = ['tile', 'map-image', 'vector-tile', 'imagery', 'imagery-tile', 'wms', 'wmts']

/** One configured basemap. Portal items carry `id` only; URL basemaps add `url` and `layerType`. */
export interface BasemapItem {
  /** Portal item id, or a generated `url-xxxxxxxx` id for a basemap added by URL. */
  id: string
  title: string
  thumbnailUrl?: string
  /** Service endpoint. Present only for basemaps added by URL. */
  url?: string
  /** Layer class for `url`. Missing or `auto` means detect from the service. */
  layerType?: UrlLayerType
}

export function isUrlBasemap (item: { url?: string } | null | undefined): boolean {
  return typeof item?.url === 'string' && item.url.trim().length > 0
}

export function isUrlLayerType (value: unknown): value is UrlLayerType {
  return value === 'auto' || URL_LAYER_TYPES.includes(value as UrlLayerType)
}

/**
 * Trim, drop a trailing slash, and drop `?f=json` style suffixes people paste from a
 * browser. Query strings that belong to the service (OGC `service=WMS`) are kept.
 */
export function normalizeServiceUrl (raw: string): string {
  let url = String(raw ?? '').trim()
  if (!url) return ''
  const q = url.indexOf('?')
  if (q >= 0) {
    const query = url.slice(q + 1)
    const keep = query
      .split('&')
      .filter(part => part && !/^f=(json|pjson|html)$/i.test(part))
      .join('&')
    url = url.slice(0, q) + (keep ? `?${keep}` : '')
  }
  const qAfter = url.indexOf('?')
  if (qAfter < 0) {
    url = url.replace(/\/+$/, '')
  }
  // A sublayer URL (.../MapServer/3) is not a service; a basemap wants the service root
  url = url.replace(/(\/mapserver)\/\d+(?=$|\?)/i, '$1')
  return url
}

/** The path part of a URL, lowercased, with query string and hash removed. */
function servicePath (url: string): string {
  return normalizeServiceUrl(url).toLowerCase().replace(/[?#].*$/, '')
}

export function isHttpUrl (url: string): boolean {
  return /^https?:\/\/[^\s/?#]+[^\s]*$/i.test(url)
}

/** Guess the layer class from the URL alone. `auto` means a probe is needed to decide. */
export function detectUrlLayerType (url: string): UrlLayerType {
  const lower = normalizeServiceUrl(url).toLowerCase()
  const path = servicePath(url)
  if (!path) return 'auto'
  // ArcGIS REST endpoints first, so a folder or service named "WMS" is not mistaken for OGC.
  // The OGC faces of an ArcGIS service (MapServer/WMTS, MapServer/WMSServer) are OGC.
  if (/\/mapserver\/wmts(\/|$)/.test(path)) return 'wmts'
  if (/\/wmsserver(\/|$)/.test(path)) return 'wms'
  if (/\/vectortileserver(\/|$)/.test(path)) return 'vector-tile'
  // Map and image services need the service description to tell cached from dynamic
  if (/\/(mapserver|imageserver)(\/|$)/.test(path)) return 'auto'
  if (/[?&]service=wmts\b/.test(lower) || /\/wmts(\/|$)/.test(path)) return 'wmts'
  if (/[?&]service=wms\b/.test(lower) || /\/wms(\/|$)/.test(path)) return 'wms'
  return 'auto'
}

/** True when `?f=json` on this URL is expected to answer with an ArcGIS REST service description. */
export function isArcGisRestUrl (url: string): boolean {
  const path = servicePath(url)
  if (/\/mapserver\/wmts(\/|$)/.test(path) || /\/wmsserver(\/|$)/.test(path)) return false
  return /\/(mapserver|imageserver|vectortileserver)(\/|$)/.test(path)
}

/**
 * Pick the layer class from an ArcGIS REST service description (`?f=json`).
 * Returns null when the JSON is not a recognizable service.
 */
export function layerTypeFromServiceInfo (url: string, info: any): UrlLayerType | null {
  if (!info || typeof info !== 'object' || info.error) return null
  const lower = servicePath(url)
  if (/\/vectortileserver(\/|$)/.test(lower)) return 'vector-tile'
  if (/\/imageserver(\/|$)/.test(lower)) {
    return info.tileInfo ? 'imagery-tile' : 'imagery'
  }
  if (/\/mapserver(\/|$)/.test(lower)) {
    return info.singleFusedMapCache === true || info.tileInfo ? 'tile' : 'map-image'
  }
  if (info.tileInfo && info.tiles) return 'vector-tile'
  if (info.singleFusedMapCache === true) return 'tile'
  if (Array.isArray(info.layers)) return 'map-image'
  return null
}

/** A usable title from the service description, else from the URL path. */
export function titleFromServiceInfo (url: string, info: any): string {
  const fromInfo = info?.documentInfo?.Title || info?.mapName || info?.name || info?.serviceDescription
  if (typeof fromInfo === 'string' && fromInfo.trim() && fromInfo.trim().toLowerCase() !== 'layers') {
    return fromInfo.trim()
  }
  return titleFromUrl(url)
}

/** The service name out of a REST URL: ".../rest/services/Basemaps/Aerial2023/MapServer" gives "Aerial2023", ".../Historic_Air_Photos/1954/MapServer" gives "1954". */
export function titleFromUrl (url: string): string {
  const path = normalizeServiceUrl(url).replace(/[?#].*$/, '').split('/').filter(Boolean)
  const skip = new Set(['mapserver', 'imageserver', 'vectortileserver', 'wmts', 'wms', 'wmsserver', 'rest', 'services', 'arcgis', 'tile', 'tiles'])
  for (let i = path.length - 1; i >= 0; i--) {
    let seg = path[i]
    try { seg = decodeURIComponent(seg) } catch { /* a literal % in the path: keep it as typed */ }
    if (!skip.has(seg.toLowerCase())) {
      return seg.replace(/[_-]+/g, ' ').trim() || seg
    }
  }
  return path[path.length - 1] || url
}

/**
 * Stable id for a URL basemap. Same URL, same id, so favorites and the default survive a
 * re-import and the same service cannot be added twice. FNV-1a over the normalized URL.
 */
export function urlBasemapId (url: string): string {
  const s = normalizeServiceUrl(url).toLowerCase()
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `url-${h.toString(16).padStart(8, '0')}`
}

/**
 * The gallery key of a Basemap on the map. Portal basemaps answer with their item id
 * (which is what another widget or the OOTB gallery sets); URL basemaps carry the
 * gallery's own id on `Basemap.id` because they have no portal item.
 */
export function basemapKey (basemap: any): string | null {
  const fromItem = basemap?.portalItem?.id
  if (typeof fromItem === 'string' && fromItem) return fromItem
  // Basemap.id is auto-generated when nothing sets it ("...-basemap-0", "streets-vector"),
  // so only an id this gallery minted counts; anything else is "not one of ours".
  const own = basemap?.id
  return typeof own === 'string' && URL_ID_PATTERN.test(own) ? own : null
}

/** Shape of the ids urlBasemapId() mints. */
export const URL_ID_PATTERN = /^url-[0-9a-f]{8}$/

/** Card thumbnail size stored in the config for a picked image file (4:3, like the gallery cards). */
export const THUMBNAIL_WIDTH = 300
export const THUMBNAIL_HEIGHT = 225

export function isDataImageUrl (value: string | null | undefined): boolean {
  return typeof value === 'string' && /^data:image\//i.test(value.trim())
}

/** A thumbnail is either an image URL (normalized like a service URL) or an inline data: image, kept as is. */
export function normalizeThumbnailUrl (value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return isDataImageUrl(text) ? text : normalizeServiceUrl(text)
}

/**
 * Source rectangle that fills a destination box the way CSS object-fit: cover does:
 * scale to cover, then crop the overflow equally from both sides.
 */
export function coverCrop (srcWidth: number, srcHeight: number, dstWidth: number, dstHeight: number): { sx: number, sy: number, sw: number, sh: number } {
  if (!(srcWidth > 0) || !(srcHeight > 0) || !(dstWidth > 0) || !(dstHeight > 0)) {
    return { sx: 0, sy: 0, sw: Math.max(0, srcWidth), sh: Math.max(0, srcHeight) }
  }
  const scale = Math.max(dstWidth / srcWidth, dstHeight / srcHeight)
  const sw = Math.min(srcWidth, Math.round(dstWidth / scale))
  const sh = Math.min(srcHeight, Math.round(dstHeight / scale))
  return { sx: Math.round((srcWidth - sw) / 2), sy: Math.round((srcHeight - sh) / 2), sw, sh }
}
