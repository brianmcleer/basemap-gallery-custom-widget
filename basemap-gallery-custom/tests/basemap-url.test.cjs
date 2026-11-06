const test = require('node:test')
const assert = require('node:assert/strict')
const { loader, hookHarness, nodes, text, LAYER_MODULES } = require('./helpers.cjs')

// ---------------------------------------------------------------------------
// Pure helpers (no esri imports): URL normalizing, type detection, stable ids
// ---------------------------------------------------------------------------
const src = loader()('src/runtime/basemapSource.ts')
const MAP = 'https://gis.example.gov/arcgis/rest/services/Basemaps/Aerial2023/MapServer'
const IMG = 'https://gis.example.gov/arcgis/rest/services/Imagery/Ortho/ImageServer'
const VTS = 'https://gis.example.gov/arcgis/rest/services/Hosted/Streets/VectorTileServer'

test('normalizeServiceUrl trims, drops trailing slashes and pasted ?f=json, keeps OGC query strings', () => {
  assert.equal(src.normalizeServiceUrl(`  ${MAP}/  `), MAP)
  assert.equal(src.normalizeServiceUrl(`${MAP}?f=pjson`), MAP)
  assert.equal(src.normalizeServiceUrl(`${MAP}/?f=json`), `${MAP}/`.replace(/\/$/, ''))
  assert.equal(src.normalizeServiceUrl('https://ogc.example.gov/wms?service=WMS&f=json'), 'https://ogc.example.gov/wms?service=WMS')
  assert.equal(src.normalizeServiceUrl(''), '')
  assert.equal(src.normalizeServiceUrl(null), '')
})

test('normalizeServiceUrl folds a sublayer URL back to the service root', () => {
  assert.equal(src.normalizeServiceUrl(`${MAP}/0`), MAP)
  assert.equal(src.normalizeServiceUrl(`${MAP}/12/`), MAP)
  assert.equal(src.normalizeServiceUrl(`${MAP}/0?token=abc`), `${MAP}?token=abc`)
  assert.equal(src.normalizeServiceUrl(`${IMG}/0`), `${IMG}/0`, 'Image services have no sublayers; the path is left alone')
})

test('Detection looks at the path only, so a token query string or a folder named WMS does not change the answer', () => {
  assert.equal(src.isArcGisRestUrl(`${MAP}?token=abc`), true)
  assert.equal(src.detectUrlLayerType(`${VTS}?token=abc`), 'vector-tile')
  assert.equal(src.layerTypeFromServiceInfo(`${MAP}?token=abc`, { singleFusedMapCache: true }), 'tile')
  assert.equal(src.detectUrlLayerType('https://gis.example.gov/arcgis/rest/services/WMS/Aerials/MapServer'), 'auto')
  assert.equal(src.isArcGisRestUrl('https://gis.example.gov/arcgis/rest/services/WMS/Aerials/MapServer'), true)
  assert.equal(src.detectUrlLayerType('https://gis.example.gov/arcgis/rest/services/WMTS/MapServer'), 'auto')
  assert.equal(src.detectUrlLayerType(`${MAP}/WMTS`), 'wmts')
  assert.equal(src.isArcGisRestUrl(`${MAP}/WMTS`), false)
  assert.equal(src.isArcGisRestUrl('https://gis.example.gov/arcgis/services/Basemaps/Aerial2023/MapServer/WMSServer'), false)
  assert.equal(src.titleFromUrl('https://gis.example.gov/arcgis/rest/services/Aerial%ZZ/MapServer'), 'Aerial%ZZ', 'A malformed percent sequence does not throw')
  assert.equal(src.titleFromUrl('https://gis.example.gov/arcgis/rest/services/Air%20Photos/MapServer'), 'Air Photos')
  assert.equal(src.basemapKey({ id: 'streets-vector' }), null)
  assert.equal(src.basemapKey({ id: 'url-0badf00d' }), 'url-0badf00d')
})

test('isHttpUrl accepts http(s) endpoints and rejects item ids, paths and spaces', () => {
  assert.equal(src.isHttpUrl(MAP), true)
  assert.equal(src.isHttpUrl('http://internal/arcgis/rest/services/x/MapServer'), true)
  assert.equal(src.isHttpUrl('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4'), false)
  assert.equal(src.isHttpUrl('/arcgis/rest/services/x/MapServer'), false)
  assert.equal(src.isHttpUrl('https://bad host/x'), false)
})

test('detectUrlLayerType knows vector tile, WMTS and WMS from the URL and defers map and image services to the probe', () => {
  assert.equal(src.detectUrlLayerType(VTS), 'vector-tile')
  assert.equal(src.detectUrlLayerType(`${VTS}/`), 'vector-tile')
  assert.equal(src.detectUrlLayerType('https://gis.example.gov/arcgis/rest/services/Basemaps/Aerial2023/MapServer/WMTS'), 'wmts')
  assert.equal(src.detectUrlLayerType('https://ogc.example.gov/geoserver/gwc/service/wmts?service=WMTS'), 'wmts')
  assert.equal(src.detectUrlLayerType('https://gis.example.gov/arcgis/services/Basemaps/Aerial2023/MapServer/WMSServer'), 'wms')
  assert.equal(src.detectUrlLayerType('https://ogc.example.gov/wms?service=WMS&request=GetCapabilities'), 'wms')
  assert.equal(src.detectUrlLayerType(MAP), 'auto')
  assert.equal(src.detectUrlLayerType(IMG), 'auto')
  assert.equal(src.detectUrlLayerType('https://tiles.example.gov/anything'), 'auto')
})

test('layerTypeFromServiceInfo tells cached from dynamic map services and tiled from dynamic image services', () => {
  assert.equal(src.layerTypeFromServiceInfo(MAP, { singleFusedMapCache: true, tileInfo: {} }), 'tile')
  assert.equal(src.layerTypeFromServiceInfo(MAP, { singleFusedMapCache: false, layers: [] }), 'map-image')
  assert.equal(src.layerTypeFromServiceInfo(IMG, { tileInfo: {} }), 'imagery-tile')
  assert.equal(src.layerTypeFromServiceInfo(IMG, { pixelType: 'U8' }), 'imagery')
  assert.equal(src.layerTypeFromServiceInfo(VTS, { tiles: ['tile/{z}/{y}/{x}.pbf'] }), 'vector-tile')
  assert.equal(src.layerTypeFromServiceInfo(MAP, { error: { code: 403 } }), null)
  assert.equal(src.layerTypeFromServiceInfo(MAP, null), null)
})

test('titleFromServiceInfo prefers the document title, then mapName, then the service folder name', () => {
  assert.equal(src.titleFromServiceInfo(MAP, { documentInfo: { Title: 'Aerial Photo 2023' }, mapName: 'Layers' }), 'Aerial Photo 2023')
  assert.equal(src.titleFromServiceInfo(MAP, { mapName: 'Layers' }), 'Aerial2023')
  assert.equal(src.titleFromServiceInfo(MAP, { mapName: 'City Aerials' }), 'City Aerials')
  assert.equal(src.titleFromUrl('https://gis.example.gov/arcgis/rest/services/Historic_Air_Photos/1954/MapServer'), '1954')
  assert.equal(src.titleFromUrl('https://gis.example.gov/arcgis/rest/services/Historic_Air_Photos/MapServer'), 'Historic Air Photos')
})

test('urlBasemapId is stable across spacing, case and trailing slashes, and differs per service', () => {
  const a = src.urlBasemapId(MAP)
  assert.match(a, /^url-[0-9a-f]{8}$/)
  assert.equal(src.urlBasemapId(`${MAP}/`), a)
  assert.equal(src.urlBasemapId(`  ${MAP.toUpperCase()} `), a)
  assert.notEqual(src.urlBasemapId(IMG), a)
})

test('basemapKey answers with the portal item id first and the gallery id for URL basemaps', () => {
  assert.equal(src.basemapKey({ portalItem: { id: 'abc' }, id: 'url-0000cafe' }), 'abc')
  assert.equal(src.basemapKey({ id: 'url-0000cafe' }), 'url-0000cafe')
  assert.equal(src.basemapKey({ id: '' }), null)
  assert.equal(src.basemapKey(null), null)
  assert.equal(src.isUrlBasemap({ url: MAP }), true)
  assert.equal(src.isUrlBasemap({ id: 'abc' }), false)
  assert.equal(src.isUrlLayerType('tile'), true)
  assert.equal(src.isUrlLayerType('shapefile'), false)
})

// ---------------------------------------------------------------------------
// Factory (esri modules mocked): the right layer class, fresh objects every call
// ---------------------------------------------------------------------------
function factoryLoader (serviceInfo) {
  const h = hookHarness()
  const fetchCalls = []
  class TestBasemap { constructor (o) { Object.assign(this, o) } async load () { return this } async loadAll () { return this } }
  const load = loader({
    ...h.mocks,
    'esri/Basemap': TestBasemap,
    // esri/request goes through IdentityManager in the real SDK; here it records the call
    'esri/request': async (url, options) => {
      fetchCalls.push(`${url}?f=${options?.query?.f}`)
      const info = typeof serviceInfo === 'function' ? serviceInfo(url) : serviceInfo
      if (info instanceof Error) throw info
      return { data: info }
    }
  })
  return { factory: load('src/runtime/basemapFactory.ts'), fetchCalls }
}

test('createBasemapForItem builds a TileLayer for a cached map service and caches the probe per URL', async () => {
  const { factory, fetchCalls } = factoryLoader({ singleFusedMapCache: true })
  const item = { id: 'url-1', title: 'Aerial', url: MAP, layerType: 'auto' }
  const bm = await factory.createBasemapForItem(item, {})
  assert.equal(bm.id, 'url-1')
  assert.equal(bm.title, 'Aerial')
  assert.equal(bm.baseLayers.length, 1)
  assert.equal(bm.baseLayers[0].kind, 'tile')
  assert.equal(bm.baseLayers[0].url, MAP)
  assert.equal(bm.portalItem, undefined)
  const again = await factory.createBasemapForItem(item, {})
  assert.notEqual(again.baseLayers[0], bm.baseLayers[0], 'Every call gets a fresh layer object')
  assert.equal(fetchCalls.length, 1, 'The service description is fetched once per page load')
  assert.match(fetchCalls[0], /MapServer\?f=json$/)
})

test('A probe that answers with an error JSON (token required) is not cached and falls back without poisoning later calls', async () => {
  let calls = 0
  const { factory } = factoryLoader(() => (++calls === 1 ? { error: { code: 499, message: 'Token Required' } } : { singleFusedMapCache: false, layers: [] }))
  const first = await factory.createBasemapForItem({ id: 'u', title: 'Secured', url: MAP }, {})
  assert.equal(first.baseLayers[0].kind, 'tile', 'Unknown service shape falls back to a tile layer')
  const second = await factory.createBasemapForItem({ id: 'u', title: 'Secured', url: MAP }, {})
  assert.equal(second.baseLayers[0].kind, 'map-image', 'The error answer was evicted, so the next probe is real')
  assert.equal(calls, 2)
})

test('createBasemapForItem picks MapImageLayer for a dynamic service and honors an explicit type without probing', async () => {
  const dynamic = factoryLoader({ singleFusedMapCache: false, layers: [] })
  const bm = await dynamic.factory.createBasemapForItem({ id: 'u', title: 'Zoning', url: MAP }, {})
  assert.equal(bm.baseLayers[0].kind, 'map-image')

  const explicit = factoryLoader(new Error('should not be called'))
  const vt = await explicit.factory.createBasemapForItem({ id: 'u', title: 'Streets', url: `${MAP}/`, layerType: 'vector-tile' }, {})
  assert.equal(vt.baseLayers[0].kind, 'vector-tile')
  assert.equal(vt.baseLayers[0].url, MAP, 'Trailing slash is normalized before the layer sees it')
  assert.equal(explicit.fetchCalls.length, 0)
})

test('createBasemapForItem falls back to a tile layer when the probe fails, and builds portal basemaps as before', async () => {
  const down = factoryLoader(new Error('network down'))
  const bm = await down.factory.createBasemapForItem({ id: 'u', title: 'Air', url: MAP }, {})
  assert.equal(bm.baseLayers[0].kind, 'tile')

  const portal = { url: 'https://portal.example.gov/portal' }
  const pm = await down.factory.createBasemapForItem({ id: 'a1b2', title: 'Topo' }, portal)
  assert.equal(pm.id, 'a1b2')
  assert.equal(pm.portalItem.id, 'a1b2')
  assert.equal(pm.portalItem.portal, portal)
  assert.equal(pm.baseLayers, undefined)
})

test('every layer module the factory imports has a test double', () => {
  const factorySource = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src/runtime/basemapFactory.ts'), 'utf8')
  for (const module of factorySource.match(/from 'esri\/layers\/[A-Za-z]+'/g).map(m => m.slice(6, -1))) {
    assert.ok(module in LAYER_MODULES, module)
  }
})

// ---------------------------------------------------------------------------
// Runtime: a URL basemap sits in the gallery next to a portal item, applies, syncs and compares
// ---------------------------------------------------------------------------
async function urlGallery () {
  const harness = hookHarness()
  const storage = new Map()
  class TestLayer { constructor (id) { this.id = id; this.destroyed = false } destroy () { this.destroyed = true } }
  class TestBasemap {
    constructor (options) {
      Object.assign(this, options)
      const collection = items => ({ toArray: () => [...items], removeAll: () => { items.length = 0 }, length: items.length })
      if (options.portalItem) {
        this.baseLayers = collection([new TestLayer(options.portalItem.id + '-base')])
        this.referenceLayers = collection([new TestLayer(options.portalItem.id + '-ref')])
      } else {
        this.baseLayers = collection([...(options.baseLayers || [])])
        this.referenceLayers = collection([])
      }
    }
    async load () { return this }
    async loadAll () { return this }
  }
  const swipes = []
  const document = {
    createElement: tag => {
      const listeners = {}
      const el = {
        tag, style: {}, removed: false,
        addEventListener: (name, fn) => { listeners[name] = fn },
        removeEventListener: name => { delete listeners[name] },
        remove () { this.removed = true },
        async destroy () {},
        fire (name) { listeners[name]?.() }
      }
      el.parentElement = { removeChild: child => { if (child === el) el.removed = true } }
      swipes.push(el)
      return el
    }
  }
  let watchCallback = null
  const load = loader({
    ...harness.mocks,
    'esri/Basemap': TestBasemap,
    'esri/request': async () => ({ data: { singleFusedMapCache: true } }),
    'esri/core/reactiveUtils': { watch: (getter, cb) => { watchCallback = cb; return { remove () {} } } }
  }, {
    document,
    customElements: { whenDefined: async () => undefined },
    setTimeout,
    clearTimeout,
    window: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } }
  })
  const Widget = load('src/runtime/widget.tsx').default
  const props = {
    id: 'urls',
    config: {
      basemaps: [
        { id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', title: 'Streets' },
        { id: 'url-cafe0001', title: 'County Aerials', url: MAP, layerType: 'tile' }
      ]
    },
    useMapWidgetIds: ['map-widget']
  }
  const render = () => harness.render(Widget, props)
  const loadingTree = render()
  const mapLayers = []
  const ui = []
  const map = {
    basemap: null,
    addMany: (layers, index) => { mapLayers.splice(index, 0, ...layers) },
    removeMany: layers => { for (const l of layers) { const i = mapLayers.indexOf(l); if (i >= 0) mapLayers.splice(i, 1) } }
  }
  const view = { when: async () => {}, map, ui: { add: el => ui.push(el), remove: el => { const i = ui.indexOf(el); if (i >= 0) ui.splice(i, 1) } } }
  nodes(loadingTree, n => n.type === 'JimuMapViewComponent')[0].props.onActiveViewChange({ id: 'view', view })
  render()
  const settle = async () => { for (let i = 0; i < 3; i++) await new Promise(resolve => setImmediate(resolve)); return render() }
  return { render, settle, map, mapLayers, swipes, fireWatch: bm => watchCallback(bm) }
}
const option = (tree, title) => nodes(tree, n => n.props.role === 'option' && n.props['aria-label'].startsWith(title))[0]

test('A URL basemap loads beside a portal item, applies to the map and is recognized by live sync', async () => {
  const s = await urlGallery()
  let tree = await s.settle()
  assert.equal(nodes(tree, n => n.props.role === 'option').length, 2)
  const aerial = option(tree, 'County Aerials')
  assert.ok(aerial, 'The URL basemap renders as a gallery card')

  aerial.props.onClick()
  tree = await s.settle()
  assert.equal(s.map.basemap.id, 'url-cafe0001')
  assert.equal(s.map.basemap.portalItem, undefined)
  assert.equal(s.map.basemap.baseLayers.toArray()[0].kind, 'tile')
  assert.match(option(tree, 'County Aerials').props['aria-label'], /currently selected/)

  // Another widget puts a portal basemap on the map: the check mark follows it
  s.fireWatch({ portalItem: { id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' } })
  tree = await s.settle()
  assert.match(option(tree, 'Streets').props['aria-label'], /currently selected/)
  assert.doesNotMatch(option(tree, 'County Aerials').props['aria-label'], /currently selected/)

  // And back to the URL basemap, which has no portal item, only the gallery id
  s.fireWatch({ id: 'url-cafe0001' })
  tree = await s.settle()
  assert.match(option(tree, 'County Aerials').props['aria-label'], /currently selected/)

  // A basemap the gallery did not make (auto-generated Basemap.id) clears the check mark
  s.fireWatch({ id: '18c3f2a1b0-basemap-0' })
  tree = await s.settle()
  assert.equal(nodes(tree, n => n.props.role === 'option' && /currently selected/.test(n.props['aria-label'])).length, 0)
  assert.ok(!text(nodes(tree, n => n.props.id === 'basemap-instructions')[0]).includes('Unknown'))
})

test('Comparing a URL basemap puts a fresh layer on the map and leaves the gallery copy alone', async () => {
  const s = await urlGallery()
  let tree = await s.settle()
  option(tree, 'Streets').props.onClick()
  tree = await s.settle()

  const compare = nodes(tree, n => n.type === 'Button' && n.props['aria-pressed'] !== undefined)[0]
  compare.props.onClick()
  tree = await s.settle()
  option(tree, 'County Aerials').props.onClick()
  tree = await s.settle()

  assert.equal(s.mapLayers.length, 1, 'One base layer from the URL basemap joins the map')
  assert.equal(s.mapLayers[0].kind, 'tile')
  assert.equal(s.mapLayers[0].url, MAP)
  assert.equal(s.mapLayers[0].listMode, 'hide')
  assert.equal(s.swipes.length, 1)
  assert.equal(s.swipes[0].startLayers.items[0], s.mapLayers[0])
  assert.equal(s.map.basemap.portalItem.id, 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', 'The map basemap is untouched by compare')

  nodes(tree, n => n.type === 'Button' && n.props['aria-pressed'] === true)[0].props.onClick()
  tree = await s.settle()
  assert.equal(s.mapLayers.length, 0)
  assert.ok(s.swipes[0].removed)
})

// ---------------------------------------------------------------------------
// Settings: the Add from URL form, the selected list, and the XML round trip
// ---------------------------------------------------------------------------
function xmlDocument (xml) {
  // A small DOMParser stand-in for the handful of calls parseXml makes
  const node = (name, body) => ({
    name,
    body,
    get textContent () { return body.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'") },
    querySelector (sel) { return this.querySelectorAll(sel)[0] || null },
    querySelectorAll (sel) {
      const parts = sel.split('>').map(p => p.trim())
      let scope = [this]
      for (const tag of parts) {
        const next = []
        for (const el of scope) {
          const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'g')
          let m
          while ((m = re.exec(el.body))) next.push(node(tag, m[1]))
        }
        scope = next
      }
      return scope
    }
  })
  return node('#document', xml)
}

function settingsHarness ({ serviceInfo, config = {} } = {}) {
  const harness = hookHarness()
  const changes = []
  const fetchCalls = []
  const React = harness.mocks['jimu-core'].React
  const mocks = {
    ...harness.mocks,
    'jimu-core': {
      ...harness.mocks['jimu-core'],
      hooks: { useTranslation: messages => (id, values) => String(messages[id] ?? id).replace(/\{(\w+)\}/g, (m, k) => values?.[k] ?? m) }
    },
    'jimu-ui': Object.fromEntries(['TextInput', 'Label', 'Switch', 'Button', 'Loading', 'Alert', 'TextArea', 'Tooltip', 'CollapsablePanel', 'Select', 'Option'].map(name => [name, name])),
    'jimu-ui/advanced/setting-components': { MapWidgetSelector: 'MapWidgetSelector', SettingSection: 'SettingSection', SettingRow: 'SettingRow' }
  }
  const load = loader(mocks, {
    DOMParser: class { parseFromString (xml) { return xmlDocument(xml) } },
    fetch: async (url) => {
      fetchCalls.push(url)
      if (/\/sharing\/rest\//.test(url)) return { ok: true, json: async () => ({ results: [] }) }
      const info = typeof serviceInfo === 'function' ? serviceInfo(url) : serviceInfo
      if (info instanceof Error) throw info
      return { ok: true, json: async () => info }
    },
    navigator: { clipboard: { writeText () {} } },
    URLSearchParams,
    setTimeout
  })
  const Setting = load('src/setting/setting.tsx').default
  const makeConfig = plain => ({
    ...plain,
    set (key, value) { return makeConfig({ ...plain, [key]: value }) },
    asMutable () { return plain }
  })
  const props = {
    id: 'w1',
    config: makeConfig({ basemaps: [], ...config }),
    onSettingChange: change => { changes.push(change); if (change.config) props.config = change.config },
    useMapWidgetIds: ['map-widget']
  }
  const render = () => harness.render(Setting, props)
  const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); return render() }
  return { render, settle, props, changes, fetchCalls, React }
}
const byClass = (tree, cls) => nodes(tree, n => typeof n.props.className === 'string' && n.props.className.split(' ').includes(cls))
const buttonWithText = (tree, label) => nodes(tree, n => n.type === 'Button' && text(n).trim() === label)[0]

test('Add from URL probes the service, picks the layer type and title, and stores a url entry', async () => {
  const s = settingsHarness({ serviceInfo: { singleFusedMapCache: true, documentInfo: { Title: 'Aerial Photo 2023' } } })
  let tree = await s.settle()
  const section = byClass(tree, 'section-content').find(n => n.props.id === 'section-add-from-url')
  assert.ok(section, 'The Add Basemap from URL section renders')

  byClass(tree, 'url-input')[0].props.onChange({ target: { value: `${MAP}/?f=pjson` } })
  tree = s.render()
  assert.equal(byClass(tree, 'add-url-btn')[0].props.disabled, false)
  byClass(tree, 'add-url-btn')[0].props.onClick()
  tree = await s.settle()

  assert.ok(s.fetchCalls.some(u => u === `${MAP}?f=json`), 'The service description is read once')
  const saved = s.changes.at(-1).config
  assert.equal(saved.basemaps.length, 1)
  const entry = saved.basemaps[0]
  assert.equal(entry.url, MAP)
  assert.equal(entry.layerType, 'tile')
  assert.equal(entry.title, 'Aerial Photo 2023')
  assert.match(entry.id, /^url-[0-9a-f]{8}$/)
  assert.equal(saved.defaultBasemapId, entry.id, 'The first basemap becomes the default')
  assert.ok(nodes(tree, n => n.type === 'Alert' && n.props.type === 'success').length, 'A success notice shows')
  assert.equal(byClass(tree, 'url-input')[0].props.value, '', 'The form resets')

  const listed = byClass(tree, 'basemap-list-item')
  assert.equal(listed.length, 1)
  assert.ok(text(listed[0]).includes('Tile layer'))
  assert.ok(text(listed[0]).includes(MAP))
  assert.ok(text(listed[0]).includes('URL'))

  // Same service again is refused
  byClass(tree, 'url-input')[0].props.onChange({ target: { value: MAP.toUpperCase() } })
  tree = s.render()
  byClass(tree, 'add-url-btn')[0].props.onClick()
  tree = await s.settle()
  assert.equal(s.props.config.basemaps.length, 1)
  assert.ok(nodes(tree, n => n.type === 'Alert' && n.props.type === 'error' && /already/.test(n.props.text)).length)
})

test('An unreachable ArcGIS service is refused on auto-detect but accepted with an explicit layer type', async () => {
  const s = settingsHarness({ serviceInfo: new Error('Failed to fetch') })
  let tree = await s.settle()
  byClass(tree, 'url-input')[0].props.onChange({ target: { value: IMG } })
  tree = s.render()
  byClass(tree, 'add-url-btn')[0].props.onClick()
  tree = await s.settle()
  assert.equal(s.changes.length, 0)
  const err = nodes(tree, n => n.type === 'Alert' && n.props.type === 'error' && /service description/.test(n.props.text))[0]
  assert.ok(err && /Failed to fetch/.test(err.props.text), 'The probe failure is shown with its reason')

  nodes(tree, n => n.type === 'Select' && n.props['aria-label'] === 'Layer type')[0].props.onChange({ target: { value: 'imagery' } })
  tree = s.render()
  byClass(tree, 'add-url-btn')[0].props.onClick()
  tree = await s.settle()
  const entry = s.changes.at(-1).config.basemaps[0]
  assert.equal(entry.layerType, 'imagery')
  assert.equal(entry.title, 'Ortho', 'Title falls back to the service name in the URL')
  assert.ok(nodes(tree, n => n.type === 'Alert' && n.props.type === 'success' && /chosen layer type/.test(n.props.text)).length)

  // Plain http URL that is neither ArcGIS REST nor OGC needs a type
  byClass(tree, 'url-input')[0].props.onChange({ target: { value: 'https://tiles.example.gov/osm' } })
  tree = s.render()
  nodes(tree, n => n.type === 'Select' && n.props['aria-label'] === 'Layer type')[0].props.onChange({ target: { value: 'auto' } })
  tree = s.render()
  byClass(tree, 'add-url-btn')[0].props.onClick()
  tree = await s.settle()
  assert.equal(s.props.config.basemaps.length, 1)
  assert.ok(nodes(tree, n => n.type === 'Alert' && n.props.type === 'error' && /Choose the layer type/.test(n.props.text)).length)

  // Not a URL at all
  byClass(tree, 'url-input')[0].props.onChange({ target: { value: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' } })
  tree = s.render()
  byClass(tree, 'add-url-btn')[0].props.onClick()
  tree = await s.settle()
  assert.ok(nodes(tree, n => n.type === 'Alert' && n.props.type === 'error' && /http/.test(n.props.text)).length)
})

test('XML export writes url and layerType and import rebuilds the same entries with recomputed ids', async () => {
  const base = { id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4', title: 'Streets & Labels', thumbnailUrl: 'https://p/x.png' }
  const urlEntry = { id: 'url-stale000', title: 'County <Aerials>', url: MAP, layerType: 'map-image' }
  const s = settingsHarness({ config: { basemaps: [base, urlEntry], defaultBasemapId: 'url-stale000', enableCompare: false } })
  let tree = await s.settle()

  buttonWithText(tree, 'Generate XML').props.onClick()
  tree = s.render()
  const xml = nodes(tree, n => n.type === 'TextArea' && n.props.readOnly)[0]?.props.value || nodes(tree, n => n.type === 'TextArea')[0].props.value
  assert.match(xml, /<url>https:\/\/gis\.example\.gov\/arcgis\/rest\/services\/Basemaps\/Aerial2023\/MapServer<\/url>/)
  assert.match(xml, /<layerType>map-image<\/layerType>/)
  assert.match(xml, /<title>County &lt;Aerials&gt;<\/title>/)
  assert.match(xml, /<title>Streets &amp; Labels<\/title>/)
  assert.equal((xml.match(/<url>/g) || []).length, 1, 'Portal items do not get a url element')

  // Import into an empty config
  const target = settingsHarness({ config: { basemaps: [] } })
  tree = await target.settle()
  const importArea = nodes(tree, n => n.type === 'TextArea' && n.props.value === '')[0]
  importArea.props.onChange({ target: { value: xml } })
  tree = target.render()
  buttonWithText(tree, 'Import Configuration').props.onClick()
  tree = await target.settle()
  const imported = target.changes.at(-1).config
  assert.equal(imported.basemaps.length, 2)
  assert.equal(imported.basemaps[0].id, base.id)
  assert.equal(imported.basemaps[0].title, base.title)
  assert.equal(imported.basemaps[0].thumbnailUrl, base.thumbnailUrl)
  assert.equal(imported.basemaps[0].url, undefined)
  assert.equal(imported.basemaps[1].url, MAP)
  assert.equal(imported.basemaps[1].layerType, 'map-image')
  assert.equal(imported.basemaps[1].title, 'County <Aerials>')
  assert.equal(imported.basemaps[1].id, src.urlBasemapId(MAP), 'The id comes from the url, not from the file')
  assert.equal(imported.defaultBasemapId, imported.basemaps[0].id, 'A default that no longer matches falls back to the first entry')
  assert.equal(imported.enableCompare, false)

  // A bad layerType in a hand-edited file degrades to auto, and a url with no title is skipped
  const hand = `<?xml version="1.0"?><BasemapGalleryConfig><basemaps>
    <basemap><title>Hand</title><url>${VTS}/</url><layerType>shapefile</layerType></basemap>
    <basemap><url>${IMG}</url></basemap>
  </basemaps></BasemapGalleryConfig>`
  importArea.props.onChange({ target: { value: hand } })
  tree = target.render()
  buttonWithText(tree, 'Import Configuration').props.onClick()
  tree = await target.settle()
  const second = target.changes.at(-1).config
  assert.equal(second.basemaps.length, 2)
  assert.equal(second.basemaps[0].url, VTS)
  assert.equal(second.basemaps[0].layerType, 'auto')
  assert.equal(second.basemaps[1].url, IMG)
  assert.equal(second.basemaps[1].title, 'Ortho', 'A url entry with no title gets one from the url instead of falling through as a portal item')
  assert.equal(second.basemaps[1].url !== undefined && second.basemaps[1].id, src.urlBasemapId(IMG))

  // A url that is not http is dropped, not imported as an item
  const bad = `<?xml version="1.0"?><BasemapGalleryConfig><basemaps><basemap><id>url-deadbeef</id><title>Nope</title><url>ftp://x/y/MapServer</url></basemap></basemaps></BasemapGalleryConfig>`
  importArea.props.onChange({ target: { value: bad } })
  tree = target.render()
  buttonWithText(tree, 'Import Configuration').props.onClick()
  tree = await target.settle()
  assert.equal(target.changes.at(-1).config.basemaps.length, 0)
})
