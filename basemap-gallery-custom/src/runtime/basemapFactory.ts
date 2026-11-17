/**
 * The widget's entry to basemapBuild.ts, with the Maps SDK classes imported statically
 * (playbook standard for runtime code). Every caller gets a fresh Basemap with fresh layer
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
import { type BasemapItem, type UrlLayerType } from './basemapSource'
import { type BasemapModules, buildBasemap, createLayerFromUrlWith, resolveUrlLayerTypeWith } from './basemapBuild'

const MODULES: BasemapModules = {
  Basemap,
  Portal,
  request: esriRequest,
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

export function resolveUrlLayerType (url: string, layerType?: UrlLayerType): Promise<Exclude<UrlLayerType, 'auto'>> {
  return resolveUrlLayerTypeWith(MODULES, url, layerType)
}

/** A new layer object for a URL basemap. */
export function createLayerFromUrl (item: BasemapItem): Promise<any> {
  return createLayerFromUrlWith(MODULES, item)
}

/** A new Basemap for a gallery entry (portal item or service URL). */
export function createBasemapForItem (item: BasemapItem, portal: InstanceType<typeof Portal> | any): Promise<Basemap> {
  return buildBasemap(MODULES, item, portal)
}
