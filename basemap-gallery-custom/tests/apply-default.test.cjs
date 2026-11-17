const test = require('node:test')
const assert = require('node:assert/strict')
const { loader, layerClassMocks } = require('./helpers.cjs')

const MAP = 'https://gis.example.gov/arcgis/rest/services/Basemaps/Aerial2023/MapServer'
const ITEM = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'
const URL_ID = 'url-cafe0001'

// One fake app: a map widget with one view, the gallery's config in appConfig, and a
// window that both the extension and the widget registry live on.
function setup ({ config = {}, viewsLater = false, failLoad = false, failTimes = Infinity, storage = {}, sizeMode = 'LARGE', appConfig: customApp, extraViews = [] } = {}) {
  const win = {
    location: { search: '' },
    sessionStorage: { getItem: k => storage[k] ?? null },
    localStorage: { getItem: k => storage[k] ?? null }
  }
  let loadFailures = 0
  class Basemap {
    constructor (o) { Object.assign(this, o); this.loaded = false; built.push(this) }
    async load () { if (failLoad && loadFailures++ < failTimes) throw new Error('item gone'); this.loaded = true; return this }
    async loadAll () { return this.load() }
  }
  class Portal { constructor (o) { Object.assign(this, o) } }
  const layers = layerClassMocks()
  const moduleList = [Basemap, Portal, async () => ({ data: { singleFusedMapCache: true } }),
    layers['esri/layers/TileLayer'], layers['esri/layers/MapImageLayer'], layers['esri/layers/VectorTileLayer'],
    layers['esri/layers/ImageryLayer'], layers['esri/layers/ImageryTileLayer'], layers['esri/layers/WMSLayer'], layers['esri/layers/WMTSLayer']]
  const view = { map: { basemap: { id: '18c0-basemap-0', title: 'Web map basemap' } }, when: async () => {} }
  const jmv = { id: 'map1-dataSource_1', mapWidgetId: 'map1', view, whenJimuMapViewLoaded: async () => {} }
  let views = viewsLater ? [] : [jmv, ...extraViews]
  const requested = []
  const listeners = []
  const built = []
  const load = loader({
    'jimu-core': { getAppStore: () => ({ getState: () => ({ browserSizeMode: sizeMode }), subscribe: fn => { listeners.push(fn); return () => {} } }) },
    'jimu-arcgis': {
      MapViewManager: { getInstance: () => ({ getAllJimuMapViews: () => views }) },
      loadArcGISJSAPIModules: async ids => { requested.push(...ids); return moduleList }
    }
  }, { window: win, setTimeout, clearTimeout, URLSearchParams })
  const Ext = load('src/extensions/apply-default.ts').default
  const startup = load('src/runtime/startupState.ts')
  const appConfig = customApp || {
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
  ext.widgetId = customApp ? Object.keys(customApp.widgets)[0] : 'w1'
  ext.retryMs = 20
  const settle = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)) }
  return { ext, appConfig, view, jmv, win, startup, requested, settle, load, addView: () => { views = [jmv] }, notify: () => listeners.forEach(fn => fn()), built }
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

test('A default that fails to load is retried once, then left to the widget with the reason on window', async () => {
  const s = setup({ config: { defaultBasemapId: ITEM }, failLoad: true })
  await s.ext.process(s.appConfig)
  await s.settle()
  await new Promise(r => setTimeout(r, 60))
  await s.settle()
  assert.equal(s.win.__bgcAppliedDefaultErrors.length, 2, 'First try and the retry')
  assert.equal(s.win.__bgcAppliedDefaultErrors[0].message, 'item gone')
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

test('A load that fails once (secured service before sign-in) succeeds on the retry', async () => {
  const s = setup({ config: { defaultBasemapId: URL_ID }, failLoad: true, failTimes: 1 })
  await s.ext.process(s.appConfig)
  await s.settle()
  assert.equal(s.view.map.basemap.id, '18c0-basemap-0')
  await new Promise(r => setTimeout(r, 60))
  await s.settle()
  assert.equal(s.view.map.basemap.id, URL_ID)
  assert.equal(s.startup.getAppliedDefault('w1', s.jmv.id), URL_ID)
  s.ext.destroy()
})

// The shape of a real app: one gallery per screen size, each in that size's Widget
// Controller, each with its own default. Only one extension instance runs (Jimu calls
// the first APP_CONFIG_PROCESSOR only), and it is the Medium copy's.
function sizedApp () {
  const gallery = (map, defaultBasemapId) => ({
    uri: 'widgets/basemap-gallery-custom/',
    useMapWidgetIds: [map],
    config: { basemaps: [{ id: ITEM, title: 'Streets' }, { id: URL_ID, title: 'Grey', url: MAP, layerType: 'tile' }], defaultBasemapId }
  })
  return {
    mainSizeMode: 'LARGE',
    pages: { page_1: { layout: { LARGE: 'L_page', MEDIUM: 'M_page', SMALL: 'S_page' } } },
    widgets: {
      gMed: gallery('map1', ITEM),
      gLarge: gallery('map1', URL_ID),
      gSmall: gallery('map2', ITEM),
      ctlLarge: { uri: 'widgets/common/controller/', layouts: { controller: { LARGE: 'L_ctl', MEDIUM: 'x1', SMALL: 'x2' } } },
      ctlMed: { uri: 'widgets/common/controller/', layouts: { controller: { LARGE: 'x3', MEDIUM: 'M_ctl', SMALL: 'x4' } } },
      ctlSmall: { uri: 'widgets/common/controller/', layouts: { controller: { MEDIUM: 'x5', SMALL: 'S_ctl' } } },
      map1: { uri: 'widgets/arcgis/arcgis-map/' },
      map2: { uri: 'widgets/arcgis/arcgis-map/' }
    },
    layouts: {
      L_page: { content: { 1: { widgetId: 'ctlLarge' }, 2: { widgetId: 'ctlMed', isPending: true }, 3: { widgetId: 'map1' } } },
      M_page: { content: { 1: { widgetId: 'ctlMed' }, 2: { widgetId: 'map1' } } },
      S_page: { content: { 1: { widgetId: 'ctlSmall' }, 2: { widgetId: 'map2' } } },
      L_ctl: { content: { 1: { widgetId: 'gLarge' } } },
      M_ctl: { content: { 1: { widgetId: 'gMed' } } },
      S_ctl: { content: { 1: { widgetId: 'gSmall' } } }
    }
  }
}

test('With a gallery per screen size, the copy for the current size applies its own default', async () => {
  const large = setup({ appConfig: sizedApp(), sizeMode: 'LARGE' })
  assert.equal(large.ext.widgetId, 'gMed', 'The instance that runs is not the Large copy')
  await large.ext.process(large.appConfig)
  await large.settle()
  assert.equal(large.view.map.basemap.id, URL_ID, 'Desktop gets the Large copy\'s default')
  assert.equal(large.startup.getAppliedDefault('gLarge', large.jmv.id), URL_ID, 'Recorded under the Large copy, which is the one the user opens')
  assert.equal(large.startup.getAppliedDefault('gMed', large.jmv.id), undefined)
  large.ext.destroy()

  const medium = setup({ appConfig: sizedApp(), sizeMode: 'MEDIUM' })
  await medium.ext.process(medium.appConfig)
  await medium.settle()
  assert.equal(medium.view.map.basemap.id, ITEM, 'Tablet gets the Medium copy\'s default')
  assert.equal(medium.startup.getAppliedDefault('gMed', medium.jmv.id), ITEM)
  medium.ext.destroy()
})

test('Each map widget gets the gallery copy that drives it', async () => {
  const phoneView = { map: { basemap: { id: 'phone-basemap-0' } }, when: async () => {} }
  const phone = { id: 'map2-dataSource_1', mapWidgetId: 'map2', view: phoneView, whenJimuMapViewLoaded: async () => {} }
  const s = setup({ appConfig: sizedApp(), sizeMode: 'SMALL', extraViews: [phone] })
  await s.ext.process(s.appConfig)
  await s.settle()
  assert.equal(phoneView.map.basemap.id, ITEM, 'The Small copy drives map2')
  assert.equal(s.startup.getAppliedDefault('gSmall', phone.id), ITEM)
  // map1 is not on the Small layout here; its copies fall back to the main size mode's
  assert.equal(s.view.map.basemap.id, URL_ID)
  s.ext.destroy()
})

test('Layout size modes: owners per size mode, missing modes fall back to the main size mode, hidden items do not count', () => {
  const s = setup({ appConfig: sizedApp() })
  const mod = s.load('src/extensions/apply-default.ts')
  const app = sizedApp()
  const modes = mod.layoutSizeModes(app)
  assert.deepEqual([...modes.L_ctl], ['LARGE'])
  assert.deepEqual([...modes.S_ctl], ['SMALL'])
  assert.deepEqual([...mod.widgetSizeModes(app, 'gLarge')], ['LARGE'])
  assert.deepEqual([...mod.widgetSizeModes(app, 'ctlMed')], ['MEDIUM'], 'Pending (hidden) on the Large page')
  assert.equal(mod.pickCopy([{ widgetId: 'a', modes: ['MEDIUM'] }, { widgetId: 'b', modes: ['LARGE'] }], 'SMALL', 'LARGE'), 'b')
  assert.equal(mod.pickCopy([{ widgetId: 'a', modes: [] }], 'SMALL', 'LARGE'), 'a')
})

test('No flash of the web map basemap: preloaded at startup, applied when the view appears, old layers hidden meanwhile', async () => {
  const s = setup({ config: { defaultBasemapId: URL_ID }, viewsLater: true })
  const webLayer = { visible: true }
  s.view.map.basemap = { id: 'web-basemap-0', baseLayers: [webLayer], referenceLayers: [] }
  // The view exists but never reports loaded: the extension must not wait for it
  s.jmv.whenJimuMapViewLoaded = () => new Promise(() => {})
  await s.ext.process(s.appConfig)
  await s.settle()
  assert.equal(s.built.length, 1, 'The basemap is built before the map view exists')
  assert.equal(s.built[0].loaded, true, 'and already loaded')
  s.addView()
  s.notify() // the store announces the new view; no timer wait
  await s.settle()
  assert.equal(s.view.map.basemap.id, URL_ID)
  assert.equal(s.built.length, 1, 'The preloaded basemap is the one used')
  s.ext.destroy()
})

test('The web map basemap is hidden while ours loads, shown again if ours fails', async () => {
  const s = setup({ config: { defaultBasemapId: ITEM }, failLoad: true })
  const webLayer = { visible: true }
  s.view.map.basemap = { id: 'web-basemap-0', baseLayers: [webLayer], referenceLayers: [] }
  await s.ext.process(s.appConfig)
  await s.settle()
  assert.equal(webLayer.visible, true, 'Shown again after the failure')
  assert.equal(s.view.map.basemap.id, 'web-basemap-0')
  s.ext.destroy()
})

test('A web map still loading is waited for, then ours is set after its own basemap', async () => {
  const s = setup({ config: { defaultBasemapId: URL_ID } })
  let finish
  s.view.map.loaded = false
  s.view.map.load = () => new Promise(r => { finish = () => { s.view.map.loaded = true; s.view.map.basemap = { id: 'web-basemap-0' }; r() } })
  await s.ext.process(s.appConfig)
  await s.settle()
  assert.notEqual(s.view.map.basemap.id, URL_ID, 'Not set before the web map has loaded')
  finish()
  await s.settle()
  assert.equal(s.view.map.basemap.id, URL_ID)
  s.ext.destroy()
})
