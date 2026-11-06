/**
 * Builds a Basemap for one configured gallery entry, from a portal item or a service URL.
 *
 * Runtime only (imports esri modules). Every caller gets a fresh Basemap with fresh layer
 * objects: the gallery, the compare overlay and the preload cache must never share layer
 * instances, because a layer can belong to one Map or Basemap at a time.
 */
import Basemap from 'esri/Basemap'
import Portal from 'esri/portal/Portal'
import TileLayer from 'esri/layers/TileLayer'
import MapImageLayer from 'esri/layers/MapImageLayer'
import VectorTileLayer from 'esri/layers/VectorTileLayer'
import ImageryLayer from 'esri/layers/ImageryLayer'
import ImageryTileLayer from 'esri/layers/ImageryTileLayer'
import WMSLayer from 'esri/layers/WMSLayer'
import WMTSLayer from 'esri/layers/WMTSLayer'
import esriRequest from 'esri/request'
import {
  type BasemapItem,
  type UrlLayerType,
  detectUrlLayerType,
  isArcGisRestUrl,
  layerTypeFromServiceInfo,
  normalizeServiceUrl
} from './basemapSource'

const LAYER_CLASSES: Record<Exclude<UrlLayerType, 'auto'>, any> = {
  tile: TileLayer,
  'map-image': MapImageLayer,
  'vector-tile': VectorTileLayer,
  imagery: ImageryLayer,
  'imagery-tile': ImageryTileLayer,
  wms: WMSLayer,
  wmts: WMTSLayer
}

/** Service descriptions already fetched this page load, keyed by normalized URL. */
const serviceInfoCache: Record<string, Promise<any>> = {}

// esri/request rather than fetch: it goes through IdentityManager, so a secured service
// answers the probe with the same credentials the layer itself will use, instead of a
// 499 "token required" JSON that would look like a dynamic service.
function fetchServiceInfo (url: string): Promise<any> {
  const key = normalizeServiceUrl(url)
  if (!serviceInfoCache[key]) {
    serviceInfoCache[key] = esriRequest(key, { query: { f: 'json' }, responseType: 'json' })
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
export async function resolveUrlLayerType (url: string, layerType?: UrlLayerType): Promise<Exclude<UrlLayerType, 'auto'>> {
  if (layerType && layerType !== 'auto') return layerType
  const guess = detectUrlLayerType(url)
  if (guess !== 'auto') return guess
  if (isArcGisRestUrl(url)) {
    try {
      const info = await fetchServiceInfo(url)
      const fromInfo = layerTypeFromServiceInfo(url, info)
      if (fromInfo && fromInfo !== 'auto') return fromInfo
    } catch {
      // Fall through: the layer's own load() will report the real problem
    }
  }
  return 'tile'
}

/** A new layer object for a URL basemap. */
export async function createLayerFromUrl (item: BasemapItem): Promise<any> {
  const url = normalizeServiceUrl(item.url ?? '')
  const type = await resolveUrlLayerType(url, item.layerType)
  const LayerClass = LAYER_CLASSES[type]
  return new LayerClass({ url, title: item.title })
}

/**
 * A new Basemap for a gallery entry. Portal items load through the portal; URL entries
 * get one base layer built from the service. `id` is set on both so the gallery can
 * recognize its own basemaps on the map through `basemapKey()`.
 */
export async function createBasemapForItem (item: BasemapItem, portal: InstanceType<typeof Portal> | any): Promise<Basemap> {
  if (item.url) {
    const layer = await createLayerFromUrl(item)
    return new Basemap({
      id: item.id,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl || undefined,
      baseLayers: [layer]
    })
  }
  return new Basemap({
    id: item.id,
    portalItem: { id: item.id, portal }
  })
}
