const test = require('node:test')
const assert = require('node:assert/strict')
const { loader, layerClassMocks } = require('./helpers.cjs')

const MAP = 'https://gis.example.gov/arcgis/rest/services/Basemaps/Aerial2023/MapServer'
const ITEM = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
const URL_ID = 'url-cafe0001'

// One fake app: a map widget with one view, the gallery's config in appConfig, and a
// window that both the extension and the widget registry live on.
function setup ({ config = {}, viewsLater = false, failLoad = false, storage = {} } = {}) {
  const win = {
    location: { search: '' },
    sessionStorage: { getItem: k => storage[k] ?? null },
    localStorage: { getItem: k => storage[k] ?? null }
  }
  class Basemap {
    constructor (o) { Object.assign(this, o); this.loaded = false }
    async load () { if (failLoad) throw new Error('item gone'); this.loaded = true; return this }
    async loadAll () { return this.load() }
  }
  class Portal { constructor (o) { Object.assign(this, o) } }
  const layers = layerClassMocks()
  const moduleList = [Basemap, Portal, async () => ({ data: { singleFusedMapCache: true } }),
    layers['esri/layers/TileLayer'], layers['esri/layers/MapImageLayer'], layers['esri/layers/VectorTileLayer'],
    layers['esri/layers/ImageryLayer'], layers['esri/layers/ImageryTileLayer'], layers['esri/layers/WMSLayer'], layers['esri/layers/WMTSLayer']]
  const view = { map: { basemap: { id: '18c0-basemap-0', title: 'Web map basemap' } }, when: async () => {} }
  const jmv = { id: 'map1-dataSource_1', mapWidgetId: 'map1', view, whenJimuMapViewLoaded: async () => {} }
  let views = viewsLater ? [] : [jmv]
  const requested = []
  const load = loader({
    'jimu-arcgis': {
      MapViewManager: { getInstance: () => ({ getAllJimuMapViews: () => views }) },
      loadArcGISJSAPIModules: async ids => { requested.push(...ids); return moduleList }
    }
  }, { window: win, setTimeout, clearTimeout, URLSearchParams })
  const Ext = load('src/extensions/apply-default.ts').default
  const startup = load('src/runtime/startupState.ts')
  const appConfig = {
    widgets: {
      w1: {
        uri: 'widgets/basemap-gallery-custom/',
        useMapWidgetIds: ['map1'],
        config: {
          basemaps: [{ id: ITEM, title: 'Streets' }, { id: URL_ID, title: 'Aerials', url: MAP, layerType: 'tile' }],
          ...config
        }
      }
    }
  }
  const ext = new Ext()
  ext.widgetId = 'w1'
  const settle = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)) }
  return { ext, appConfig, view, jmv, win, startup, requested, settle, addView: () => { views = [jmv] } }
}

test('The default is applied at app load with the widget never opened, and recorded for the widget', async () => {
  const s = setup({ config: { defaultBasemapId: URL_ID } })
  const out = await s.ext.process(s.appConfig)
  assert.equal(out, s.appConfig, 'App config is returned untouched')
  await s.settle()
  assert.equal(s.view.map.basemap.id, URL_ID)
  assert.equal(s.view.map.basemap.baseLayers[0].kind, 'tile')
  assert.equal(s.view.map.basemap.baseLayers[0].url, MAP)
  assert.equal(s.startup.getAppliedDefault('w1', s.jmv.id), URL_ID)
  assert.ok(s.requested.includes('esri/Basemap'), 'esri modules come from loadArcGISJSAPIModules, not static imports')
  s.ext.destroy()
})

test('A portal item default loads through the portal and the map view can appear after startup', async () => {
  const s = setup({ config: { defaultBasemapId: ITEM, portalUrl: 'https://portal.example.gov/portal' }, viewsLater: true })
  await s.ext.process(s.appConfig)
  await s.settle()
  assert.equal(s.view.map.basemap.id, '18c0-basemap-0', 'Nothing happens before the map view exists')
  s.addView()
  await new Promise(r => setTimeout(r, 400))
  await s.settle()
  assert.equal(s.view.map.basemap.id, ITEM)
  assert.equal(s.view.map.basemap.portalItem.id, ITEM)
  assert.equal(s.view.map.basemap.portalItem.portal.url, 'https://portal.example.gov/portal')
  s.ext.destroy()
})

test('Nothing happens with no default, when the widget already applied it, or when the map already shows it', async () => {
  const none = setup()
  await none.ext.process(none.appConfig)
  await none.settle()
  assert.equal(none.view.map.basemap.id, '18c0-basemap-0')
  assert.equal(none.startup.getAppliedDefault('w1', none.jmv.id), undefined)
  none.ext.destroy()

  const open = setup({ config: { defaultBasemapId: URL_ID } })
  open.startup.setAppliedDefault('w1', open.jmv.id, URL_ID)
  open.view.map.basemap = { id: 'user-picked' }
  await open.ext.process(open.appConfig)
  await open.settle()
  assert.equal(open.view.map.basemap.id, 'user-picked', 'An open widget that applied first is not overridden')
  open.ext.destroy()

  const same = setup({ config: { defaultBasemapId: ITEM } })
  same.view.map.basemap = { portalItem: { id: ITEM }, id: 'webmap' }
  await same.ext.process(same.appConfig)
  await same.settle()
  assert.equal(same.view.map.basemap.id, 'webmap', 'Already showing the default: left alone')
  same.ext.destroy()
})

test('A Map Switcher basemap wins: applied if in the gallery, left to Map Switcher if not', async () => {
  const fresh = JSON.stringify({ value: `item:${ITEM}`, ts: Date.now() })
  const inGallery = setup({ config: { defaultBasemapId: URL_ID }, storage: { 'ms-basemap-handoff': fresh } })
  await inGallery.ext.process(inGallery.appConfig)
  await inGallery.settle()
  assert.equal(inGallery.view.map.basemap.id, ITEM)
  assert.equal(inGallery.startup.getAppliedDefault('w1', inGallery.jmv.id), URL_ID, 'Default marked handled so the widget will not override the carried one')
  inGallery.ext.destroy()

  const other = JSON.stringify({ value: 'item:ffffffffffffffffffffffffffffffff', ts: Date.now() })
  const notInGallery = setup({ config: { defaultBasemapId: URL_ID }, storage: { 'ms-basemap-handoff': other } })
  await notInGallery.ext.process(notInGallery.appConfig)
  await notInGallery.settle()
  assert.equal(notInGallery.view.map.basemap.id, '18c0-basemap-0')
  assert.equal(notInGallery.startup.getAppliedDefault('w1', notInGallery.jmv.id), URL_ID)
  notInGallery.ext.destroy()
})

test('A default that fails to load leaves the map alone and clears the record so the widget can retry', async () => {
  const s = setup({ config: { defaultBasemapId: ITEM }, failLoad: true })
  await s.ext.process(s.appConfig)
  await s.settle()
  assert.equal(s.view.map.basemap.id, '18c0-basemap-0')
  assert.equal(s.startup.getAppliedDefault('w1', s.jmv.id), undefined)
  s.ext.destroy()
})

test('The manifest registers the extension and the extension has no static esri imports', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const root = path.join(__dirname, '..')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  const ext = manifest.extensions.find(e => e.point === 'APP_CONFIG_PROCESSOR')
  assert.ok(ext)
  assert.equal(ext.uri, 'extensions/apply-default')
  assert.ok(fs.existsSync(path.join(root, 'src', `${ext.uri}.ts`)), 'The build finds src/<uri>.ts')
  for (const file of ['src/extensions/apply-default.ts', 'src/runtime/basemapBuild.ts', 'src/runtime/startupState.ts', 'src/runtime/basemapSource.ts']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /from 'esri\//, file)
  }
})
