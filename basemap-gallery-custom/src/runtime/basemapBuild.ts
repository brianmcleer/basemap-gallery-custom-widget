/**
 * Builds a Basemap for one configured gallery entry, from a portal item or a service URL,
 * with the Maps SDK classes handed in rather than imported.
 *
 * Two bundles use this: the widget (through basemapFactory.ts, which passes statically
 * imported esri modules) and the startup extension (extensions/apply-default.ts, which
 * loads them with loadArcGISJSAPIModules because it can also be loaded where no map is).
 * Keeping the logic here means a gallery card and the basemap applied at app load are
 * always built the same way. This file must stay free of esri imports.
 */
import {
  type BasemapItem,
  type UrlLayerType,
  detectUrlLayerType,
  isArcGisRestUrl,
  layerTypeFromServiceInfo,
  normalizeServiceUrl
} from './basemapSource'

/** Module ids, in the order BasemapModules lists them, for loadArcGISJSAPIModules. */
export const BASEMAP_MODULE_IDS = [
  'esri/Basemap',
  'esri/portal/Portal',
  'esri/request',
  'esri/layers/TileLayer',
  'esri/layers/MapImageLayer',
  'esri/layers/VectorTileLayer',
  'esri/layers/ImageryLayer',
  'esri/layers/ImageryTileLayer',
  'esri/layers/WMSLayer',
  'esri/layers/WMTSLayer'
]

export interface BasemapModules {
  Basemap: any
  Portal: any
  request: (url: string, options?: any) => Promise<any>
  layers: Record<Exclude<UrlLayerType, 'auto'>, any>
}

/** Turn the array loadArcGISJSAPIModules resolves with into BasemapModules. */
export function modulesFromList (list: any[]): BasemapModules {
  const [Basemap, Portal, request, TileLayer, MapImageLayer, VectorTileLayer, ImageryLayer, ImageryTileLayer, WMSLayer, WMTSLayer] = list
  return {
    Basemap,
    Portal,
    request,
    layers: {
      tile: TileLayer,
      'map-image': MapImageLayer,
      'vector-tile': VectorTileLayer,
      imagery: ImageryLayer,
      'imagery-tile': ImageryTileLayer,
      wms: WMSLayer,
      wmts: WMTSLayer
    }
  }
}

/** Service descriptions already fetched this page load, keyed by normalized URL. */
const serviceInfoCache: Record<string, Promise<any>> = {}

// esri/request rather than fetch: it goes through IdentityManager, so a secured service
// answers the probe with the same credentials the layer itself will use, instead of a
// 499 "token required" JSON that would look like a dynamic service.
function fetchServiceInfo (mods: BasemapModules, url: string): Promise<any> {
  const key = normalizeServiceUrl(url)
  if (!serviceInfoCache[key]) {
    serviceInfoCache[key] = mods.request(key, { query: { f: 'json' }, responseType: 'json' })
      .then((response: any) => {
        const info = response?.data
        if (!info || info.error) {
          delete serviceInfoCache[key]
          throw new Error(info?.error?.message || 'No service description')
        }
        return info
      })
      .catch((err: any) => {
        delete serviceInfoCache[key]
        throw err
      })
  }
  return serviceInfoCache[key]
}

/**
 * Turn `auto` (or a missing type) into a concrete layer type. ArcGIS REST services are
 * asked for their description so a dynamic map service does not end up as a TileLayer.
 * Anything else falls back to the URL pattern, then to a cached tile layer.
 */
export async function resolveUrlLayerTypeWith (mods: BasemapModules, url: string, layerType?: UrlLayerType): Promise<Exclude<UrlLayerType, 'auto'>> {
  if (layerType && layerType !== 'auto') return layerType
  const guess = detectUrlLayerType(url)
  if (guess !== 'auto') return guess
  if (isArcGisRestUrl(url)) {
    try {
      const info = await fetchServiceInfo(mods, url)
      const fromInfo = layerTypeFromServiceInfo(url, info)
      if (fromInfo && fromInfo !== 'auto') return fromInfo
    } catch {
      // Fall through: the layer's own load() will report the real problem
    }
  }
  return 'tile'
}

/** A new layer object for a URL basemap. */
export async function createLayerFromUrlWith (mods: BasemapModules, item: BasemapItem): Promise<any> {
  const url = normalizeServiceUrl(item.url ?? '')
  const type = await resolveUrlLayerTypeWith(mods, url, item.layerType)
  const LayerClass = mods.layers[type]
  return new LayerClass({ url, title: item.title })
}

/**
 * A new Basemap for a gallery entry. Portal items load through the portal; URL entries
 * get one base layer built from the service. `id` is set on both so the gallery can
 * recognize its own basemaps on the map through `basemapKey()`.
 */
export async function buildBasemap (mods: BasemapModules, item: BasemapItem, portal: any): Promise<any> {
  if (item.url) {
    const layer = await createLayerFromUrlWith(mods, item)
    return new mods.Basemap({
      id: item.id,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl || undefined,
      baseLayers: [layer]
    })
  }
  return new mods.Basemap({
    id: item.id,
    portalItem: { id: item.id, portal }
  })
}
