const test = require('node:test')
const assert = require('node:assert/strict')
const { loader, translate, hookHarness, nodes, text } = require('./helpers.cjs')

function setup () {
  const harness = hookHarness()
  const load = loader(harness.mocks)
  const messages = load('src/runtime/translations/default.ts').default
  const build = load('src/runtime/helpSections.ts').buildHelpSections
  const Component = load('src/runtime/components/HelpPopup.tsx').default
  let closed = 0
  const props = {
    open: true, onClose: () => { closed++ },
    sections: build(translate(messages), { mapConnected: true, galleryAvailable: true, search: true, favorites: true }),
    title: messages.helpTitle, intro: messages.helpIntro, searchPlaceholder: messages.helpSearchPlaceholder,
    noMatches: messages.helpNoMatches, closeLabel: messages.close
  }
  const render = () => harness.render(Component, props)
  return { ...harness, load, messages, Component, props, render, closed: () => closed }
}

test('Opens at Start here with one section expanded; changing sections closes the old one', () => {
  const s = setup()
  let tree = s.render()
  assert.equal(nodes(tree, n => n.type === 'Modal')[0].props.size, 'sm')
  assert.equal(nodes(tree, n => n.type === 'ModalBody')[0].props.style.maxHeight, '70vh')
  let expanded = nodes(tree, n => n.type === 'button' && n.props['aria-expanded'])
  assert.equal(expanded.length, 1)
  assert.ok(text(expanded[0]).includes(s.messages.helpStartTitle))
  nodes(tree, n => n.type === 'button' && text(n).includes(s.messages.helpFavoritesTitle))[0].props.onClick()
  tree = s.render()
  expanded = nodes(tree, n => n.type === 'button' && n.props['aria-expanded'])
  assert.equal(expanded.length, 1)
  assert.ok(text(expanded[0]).includes(s.messages.helpFavoritesTitle))
  expanded[0].props.onClick()
  assert.equal(nodes(s.render(), n => n.type === 'button' && n.props['aria-expanded']).length, 0)
})

test('Search filters matching lines, highlights text, and automatically opens a matching section', () => {
  const s = setup()
  let tree = s.render()
  const input = nodes(tree, n => n.type === 'TextInput')[0]
  assert.equal(input.props['aria-label'], s.props.searchPlaceholder)
  input.props.onChange({ target: { value: '  FILTER  ' } })
  tree = s.render()
  const expanded = nodes(tree, n => n.type === 'button' && n.props['aria-expanded'])
  assert.equal(expanded.length, 1)
  assert.ok(text(expanded[0]).includes(s.messages.helpOrganizeTitle))
  const lines = nodes(tree, n => n.type === 'li')
  assert.equal(lines.length, 1)
  assert.ok(text(lines[0]).includes('Filter basemaps...'))
  assert.ok(nodes(tree, n => n.type === 'mark').length > 0)
})

test('Matching a section title preserves that section\'s complete list', () => {
  const s = setup()
  let tree = s.render()
  nodes(tree, n => n.type === 'TextInput')[0].props.onChange({ target: { value: 'Keep favorites' } })
  tree = s.render()
  assert.equal(nodes(tree, n => n.type === 'li').length, 3)
})

test('No-match message and close/reopen reset work without retaining a stale query', () => {
  const s = setup()
  let tree = s.render()
  nodes(tree, n => n.type === 'TextInput')[0].props.onChange({ target: { value: 'does-not-match-anything' } })
  tree = s.render()
  assert.ok(text(tree).includes(s.messages.helpNoMatches))
  assert.equal(nodes(tree, n => n.type === 'button').length, 0)
  nodes(tree, n => n.type === 'Button' && text(n) === 'Close')[0].props.onClick()
  assert.equal(s.closed(), 1)
  s.props.open = false
  assert.equal(s.render(), null)
  s.props.open = true
  tree = s.render()
  assert.equal(nodes(tree, n => n.type === 'TextInput')[0].props.value, '')
  assert.ok(text(nodes(tree, n => n.type === 'button' && n.props['aria-expanded'])[0]).includes(s.messages.helpStartTitle))
  nodes(tree, n => n.type === 'ModalHeader')[0].props.toggle()
  assert.equal(s.closed(), 2)
})

test('The shared hint has its accessible controls and uses the passed translation', () => {
  const s = setup()
  let opened = 0; let dismissed = 0
  const props = { showFirstRunHint: true, t: translate(s.messages), onOpenHelp: () => { opened++ }, onDismissHint: () => { dismissed++ } }
  let tree // separate hook lifetime for this component
  const h = hookHarness()
  const load = loader(h.mocks)
  const Component = load('src/runtime/components/FirstRunHint.tsx').default
  tree = h.render(Component, props)
  assert.equal(nodes(tree, n => n.props.role === 'note').length, 1)
  nodes(tree, n => n.type === 'button')[0].props.onClick()
  assert.equal(opened, 1)
  const close = nodes(tree, n => n.type === 'Button')[0]
  assert.equal(close.props.title, close.props['aria-label'])
  close.props.onClick()
  assert.equal(dismissed, 1)
  props.showFirstRunHint = false
  assert.equal(nodes(h.render(Component, props), n => n.props.role === 'note').length, 0)
})

test('The real widget Help handler opens the guide and remembers dismissal even with no map', () => {
  const harness = hookHarness()
  const storage = new Map()
  const load = loader(harness.mocks, { window: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } } })
  const Widget = load('src/runtime/widget.tsx').default
  const Help = load('src/runtime/components/HelpPopup.tsx').default
  const Hint = load('src/runtime/components/FirstRunHint.tsx').default
  const props = { id: 'one', config: {}, useMapWidgetIds: [] }
  let tree = harness.render(Widget, props)
  assert.equal(nodes(tree, n => n.type === Hint)[0].props.showFirstRunHint, true)
  assert.equal(nodes(tree, n => n.type === Help)[0].props.open, false)
  const button = nodes(tree, n => n.type === 'Button' && n.props.title === 'Help')[0]
  assert.equal(button.props['aria-label'], 'Help')
  button.props.onClick()
  tree = harness.render(Widget, props)
  assert.equal(nodes(tree, n => n.type === Help)[0].props.open, true)
  assert.equal(nodes(tree, n => n.type === Hint)[0].props.showFirstRunHint, false)
  assert.equal(storage.get('basemapGalleryCustom.helpHintDismissed.one'), '1')
  assert.ok(!storage.has('bgc-favorites-one'))
  props.id = 'two'
  tree = harness.render(Widget, props)
  assert.equal(nodes(tree, n => n.type === Hint)[0].props.showFirstRunHint, true)
})

// Exercise the real widget tree with local ArcGIS doubles, not live map services.
async function headerGallery (count, displayMode = 'grid') {
  const harness = hookHarness()
  const storage = new Map()
  class TestBasemap {
    constructor (options) { this.portalItem = options.portalItem }
    async load () { return this }
    async loadAll () { return this }
  }
  const load = loader({ ...harness.mocks, 'esri/Basemap': TestBasemap }, {
    window: { localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    } }
  })
  const Widget = load('src/runtime/widget.tsx').default
  const Help = load('src/runtime/components/HelpPopup.tsx').default
  const props = {
    id: 'header-' + displayMode,
    config: {
      displayMode,
      basemaps: Array.from({ length: count }, (_, index) => ({
        id: 'map-' + (index + 1), title: 'Basemap ' + (index + 1)
      }))
    },
    useMapWidgetIds: ['map-widget']
  }
  const render = () => harness.render(Widget, props)
  const loadingTree = render()
  const view = { when: async () => {}, map: {} }
  nodes(loadingTree, n => n.type === 'JimuMapViewComponent')[0].props.onActiveViewChange({ id: 'view', view })
  render()
  await new Promise(resolve => setImmediate(resolve))
  return { render, Help, loadingTree, storage }
}

function headerParts (tree) {
  const headers = nodes(tree, n => n.props.className === 'gallery-header')
  assert.equal(headers.length, 1, 'There is one shared header, not a separate Help row')
  const header = headers[0]
  const help = nodes(header, n => n.type === 'Button' && n.props.title === 'Help')
  assert.equal(help.length, 1)
  assert.equal(help[0].props.style.flexShrink, 0)
  const compare = nodes(header, n => n.type === 'Button' && n.props['aria-pressed'] !== undefined)
  assert.ok(compare.length <= 1)
  return { header, help: help[0], compare: compare[0], inputs: nodes(header, n => n.type === 'TextInput') }
}

for (const mode of ['grid', 'list']) {
  test(mode + ': filter and Help share one shrinkable, non-wrapping header and still work', async () => {
    const s = await headerGallery(9, mode)
    let tree = s.render()
    let parts = headerParts(tree)
    assert.equal(parts.inputs.length, 1)
    assert.equal(nodes(tree, n => n.type === 'TextInput').length, 1, 'No duplicate filter below the header')
    assert.equal(parts.inputs[0].props.placeholder, 'Filter basemaps...')
    assert.equal(parts.inputs[0].props['aria-label'], 'Filter basemaps by name')
    assert.equal(parts.inputs[0].props.allowClear, true)
    assert.equal(parts.inputs[0].props.style.minWidth, 0)
    assert.equal(parts.inputs[0].props.style.width, '100%')
    const children = parts.header.props.children.filter(n => n && typeof n === 'object')
    assert.equal(children.length, 3)
    assert.equal(children[0].props.className, 'search-container')
    assert.equal(children[1].type, 'Tooltip', 'Compare sits between the filter and Help, with a tooltip')
    assert.equal(nodes(children[1], n => n === parts.compare).length, 1)
    assert.equal(parts.compare.props.title, 'Compare basemaps')
    assert.equal(parts.compare.props.type, 'secondary')
    assert.ok(text(parts.compare).includes('Compare'), 'Compare shows a text label, not only an icon')
    const sticky = nodes(tree, n => n.props.className === 'gallery-sticky')
    assert.equal(sticky.length, 1)
    assert.equal(nodes(sticky[0], n => n.props.className === 'gallery-header').length, 1, 'The header lives inside the sticky wrapper')
    const stickyCSS = tree.props.css.match(/\.gallery-sticky\s*\{([^}]+)\}/)[1]
    assert.match(stickyCSS, /position:\s*sticky;/)
    assert.match(stickyCSS, /top:\s*0;/)
    assert.equal(parts.compare.props['aria-pressed'], false)
    assert.equal(parts.compare.props.style.flexShrink, 0)
    assert.equal(children[2], parts.help, 'Help stays at the far right')
    const headerCSS = tree.props.css.match(/\.gallery-header\s*\{([^}]+)\}/)[1]
    assert.match(headerCSS, /display:\s*flex;/)
    assert.match(headerCSS, /align-items:\s*center;/)
    assert.match(headerCSS, /flex-wrap:\s*nowrap;/)
    assert.match(headerCSS, /justify-content:\s*flex-end;/)
    const filterCSS = tree.props.css.match(/\.search-container\s*\{([^}]+)\}/)[1]
    assert.match(filterCSS, /flex:\s*1 1 0%;/)
    assert.match(filterCSS, /min-width:\s*0;/)
    assert.doesNotMatch(filterCSS, /padding:/)

    parts.inputs[0].props.onChange({ target: { value: 'Basemap 2' } })
    tree = s.render()
    parts = headerParts(tree)
    assert.equal(parts.inputs[0].props.value, 'Basemap 2')
    assert.equal(nodes(tree, n => n.props.role === 'option').length, 1)
    parts.inputs[0].props.onChange({ target: { value: 'no matching name' } })
    tree = s.render()
    parts = headerParts(tree)
    assert.equal(parts.inputs.length, 1, 'Filter remains available when it finds nothing')
    assert.equal(nodes(tree, n => n.props.className === 'no-results').length, 1)
    parts.help.props.onClick()
    tree = s.render()
    assert.equal(nodes(tree, n => n.type === s.Help)[0].props.open, true)
    assert.equal(headerParts(tree).inputs[0].props.value, 'no matching name')
    assert.equal(s.storage.get('basemapGalleryCustom.helpHintDismissed.header-' + mode), '1')
    nodes(tree, n => n.type === s.Help)[0].props.onClose()
    headerParts(s.render()).inputs[0].props.onChange({ target: { value: '' } })
    tree = s.render()
    assert.equal(nodes(tree, n => n.props.role === 'option').length, 9)
    assert.equal(headerParts(tree).inputs[0].props.value, '')
  })
}

test('Small galleries keep Help right-aligned without showing a filter', async () => {
  const s = await headerGallery(8)
  const parts = headerParts(s.render())
  assert.equal(parts.inputs.length, 0)
  assert.equal(parts.header.props.children.filter(n => n && typeof n === 'object').length, 2)
  assert.ok(parts.compare, 'Compare remains available for small galleries')
  parts.help.props.onClick()
  assert.equal(nodes(s.render(), n => n.type === s.Help)[0].props.open, true)
})

test('Loading and disconnected views retain Help without a stale filter', async () => {
  const s = await headerGallery(9)
  assert.equal(headerParts(s.loadingTree).inputs.length, 0)
  assert.equal(headerParts(s.loadingTree).compare, undefined, 'Compare waits for the gallery')
  assert.equal(headerParts(s.render()).inputs.length, 1)
  nodes(s.render(), n => n.type === 'JimuMapViewComponent')[0].props.onActiveViewChange(null)
  const parts = headerParts(s.render())
  assert.equal(parts.inputs.length, 0)
  parts.help.props.onClick()
  assert.equal(nodes(s.render(), n => n.type === s.Help)[0].props.open, true)
})

// Compare: the header button, the slider bar, the gallery badge, and the settings gate.
async function compareGallery (config = {}) {
  const harness = hookHarness()
  const storage = new Map()
  class TestLayer {
    constructor (id) { this.id = id; this.destroyed = false }
    destroy () { this.destroyed = true }
  }
  class TestBasemap {
    constructor (options) {
      this.portalItem = options.portalItem
      const base = new TestLayer(options.portalItem.id + '-base')
      const ref = new TestLayer(options.portalItem.id + '-ref')
      const collection = items => ({ toArray: () => [...items], removeAll: () => { items.length = 0 } })
      this.baseLayers = collection([base])
      this.referenceLayers = collection([ref])
    }
    async load () { return this }
    async loadAll () { return this }
  }
  const swipes = []
  const document = {
    createElement: tag => {
      const listeners = {}
      const el = {
        tag,
        style: {},
        removed: false,
        destroyed: false,
        addEventListener: (name, fn) => { listeners[name] = fn },
        removeEventListener: name => { delete listeners[name] },
        remove () { this.removed = true },
        async destroy () { this.destroyed = true },
        fire (name) { listeners[name]?.() }
      }
      swipes.push(el)
      return el
    }
  }
  const customElements = { whenDefined: async () => undefined }
  const load = loader({ ...harness.mocks, 'esri/Basemap': TestBasemap }, {
    document,
    customElements,
    setTimeout,
    clearTimeout,
    window: { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) } }
  })
  const Widget = load('src/runtime/widget.tsx').default
  const props = {
    id: 'compare',
    config: {
      ...config,
      basemaps: [{ id: 'map-1', title: 'Streets' }, { id: 'map-2', title: 'Imagery' }, { id: 'map-3', title: 'Topo' }]
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
  await new Promise(resolve => setImmediate(resolve))
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); return render() }
  return { render, settle, props, view, map, mapLayers, ui, swipes }
}

const option = (tree, title) => nodes(tree, n => n.props.role === 'option' && n.props['aria-label'].startsWith(title))[0]

test('Compare places the chosen basemap behind an arcgis-swipe divider and the slider drives it', async () => {
  const s = await compareGallery()
  let tree = s.render()
  option(tree, 'Streets').props.onClick()
  tree = s.render()
  assert.equal(s.map.basemap.portalItem.id, 'map-1')
  assert.equal(nodes(tree, n => n.props.className === 'compare-bar').length, 0)

  headerParts(tree).compare.props.onClick()
  tree = s.render()
  const bar = nodes(tree, n => n.props.className === 'compare-bar')
  assert.equal(bar.length, 1)
  assert.ok(text(bar[0]).includes('Choose a basemap to show on the left side of the map.'))
  assert.equal(headerParts(tree).compare.props['aria-pressed'], true)
  assert.equal(headerParts(tree).compare.props.title, 'Close compare')
  assert.equal(headerParts(tree).compare.props.type, 'primary')
  assert.ok(text(headerParts(tree).compare).includes('Close'))
  assert.equal(nodes(nodes(tree, n => n.props.className === 'gallery-sticky')[0], n => n.props.className === 'compare-bar').length, 1, 'The compare bar is inside the sticky wrapper')

  option(tree, 'Imagery').props.onClick()
  tree = await s.settle()
  assert.equal(s.map.basemap.portalItem.id, 'map-1', 'Compare does not change the current basemap')
  assert.equal(s.mapLayers.length, 2, 'Base and reference layers of the compare basemap join the map')
  assert.equal(s.swipes.length, 1)
  const swipe = s.swipes[0]
  assert.equal(swipe.tag, 'arcgis-swipe')
  assert.equal(swipe.view, s.view)
  assert.equal(swipe.position, 50)
  assert.equal(swipe.style.pointerEvents, 'none', 'The swipe host must not block map pan and zoom')
  assert.equal(swipe.startLayers.items.map(l => l.id).join(), s.mapLayers.map(l => l.id).join())
  assert.equal(s.ui.length, 1)
  assert.equal(s.ui[0], swipe)

  const slider = nodes(tree, n => n.type === 'CalciteSlider')[0]
  assert.equal(slider.props.value, 50)
  assert.equal(slider.props.min, 0)
  assert.equal(slider.props.max, 100)
  assert.ok(slider.props.label.includes('Imagery') && slider.props.label.includes('Streets'))
  slider.props.onCalciteSliderInput({ target: { value: '72' } })
  tree = s.render()
  assert.equal(swipe.position, 72)
  assert.equal(nodes(tree, n => n.type === 'CalciteSlider')[0].props.value, 72)

  swipe.position = 31.6
  swipe.fire('arcgisSwipeInput')
  tree = s.render()
  assert.equal(nodes(tree, n => n.type === 'CalciteSlider')[0].props.value, 32)

  assert.equal(nodes(tree, n => n.props.className === 'compare-indicator').length, 1)
  assert.equal(nodes(tree, n => n.props.className === 'compare-indicator right').length, 1, 'The current basemap shows a Right badge')
  assert.ok(text(nodes(tree, n => n.props.className === 'compare-indicator right')[0]).includes('Right'))
  assert.match(option(tree, 'Streets').props['aria-label'], /right side for comparison/)
  assert.match(option(tree, 'Imagery').props.className, /comparing/)
  assert.match(option(tree, 'Imagery').props['aria-label'], /left side for comparison/)
  const labels = nodes(tree, n => n.props.className === 'compare-labels')[0]
  assert.ok(text(labels).includes('Imagery') && text(labels).includes('Streets'))

  option(tree, 'Streets').props.onClick()
  tree = await s.settle()
  assert.equal(s.swipes.length, 1, 'The current basemap cannot be chosen for the left side')

  const imageryLayers = [...s.mapLayers]
  option(tree, 'Topo').props.onClick()
  tree = await s.settle()
  assert.equal(s.swipes.length, 2, 'Choosing another basemap replaces the left side')
  assert.equal(swipe.removed, true)
  assert.equal(s.ui.length, 1)
  assert.equal(s.mapLayers.length, 2)
  assert.ok(s.mapLayers.every(l => l.id.startsWith('map-3')))
  assert.equal(s.swipes[1].position, 32, 'The divider keeps its position when the left side changes')
  assert.ok(imageryLayers.length === 2 && imageryLayers.every(l => l.destroyed), 'Replaced compare layers are destroyed')

  headerParts(tree).compare.props.onClick()
  tree = s.render()
  assert.equal(s.mapLayers.length, 0)
  assert.equal(s.ui.length, 0)
  assert.equal(s.swipes[1].removed, true)
  assert.equal(nodes(tree, n => n.props.className === 'compare-bar').length, 0)
  assert.equal(nodes(tree, n => n.props.className === 'compare-indicator').length, 0)
  assert.equal(nodes(tree, n => n.props.className === 'compare-indicator right').length, 0)
  assert.equal(s.map.basemap.portalItem.id, 'map-1')

  option(tree, 'Topo').props.onClick()
  tree = s.render()
  assert.equal(s.map.basemap.portalItem.id, 'map-3', 'Normal selection returns after compare closes')
})

test('The C key compares the focused basemap and the guide reflects compare availability', async () => {
  const s = await compareGallery()
  let tree = s.render()
  option(tree, 'Streets').props.onClick()
  tree = s.render()
  let prevented = 0
  option(tree, 'Topo').props.onKeyDown({ key: 'c', preventDefault: () => { prevented++ } })
  tree = await s.settle()
  assert.equal(prevented, 1)
  assert.equal(s.swipes.length, 1)
  assert.equal(headerParts(tree).compare.props['aria-pressed'], true)
  const help = nodes(tree, n => n.props.sections)[0].props.sections
  assert.ok(help.some(section => section.key === 'compare'))
  assert.ok(help.find(section => section.key === 'compare').body.some(line => line.startsWith('Compare is on now')))
  assert.ok(text(nodes(tree, n => n.props.id === 'basemap-instructions')[0]).includes('Press C'))
})

test('Compare can be switched off in settings; the button, key, and guide section disappear', async () => {
  const s = await compareGallery({ enableCompare: false })
  let tree = s.render()
  assert.equal(headerParts(tree).compare, undefined)
  option(tree, 'Streets').props.onClick()
  tree = s.render()
  let prevented = 0
  option(tree, 'Topo').props.onKeyDown({ key: 'C', preventDefault: () => { prevented++ } })
  tree = await s.settle()
  assert.equal(prevented, 0)
  assert.equal(s.swipes.length, 0)
  assert.equal(s.mapLayers.length, 0)
  const help = nodes(tree, n => n.props.sections)[0].props.sections
  assert.ok(!help.some(section => section.key === 'compare'))
  assert.ok(!text(nodes(tree, n => n.props.id === 'basemap-instructions')[0]).includes('Press C'))
})

test('Browser shortcuts are left alone and removing the compared basemap from settings clears the map', async () => {
  const s = await compareGallery()
  let tree = s.render()
  option(tree, 'Streets').props.onClick()
  tree = s.render()
  let prevented = 0
  option(tree, 'Topo').props.onKeyDown({ key: 'c', ctrlKey: true, preventDefault: () => { prevented++ } })
  option(tree, 'Topo').props.onKeyDown({ key: 'f', metaKey: true, preventDefault: () => { prevented++ } })
  tree = await s.settle()
  assert.equal(prevented, 0)
  assert.equal(s.swipes.length, 0)

  option(tree, 'Topo').props.onKeyDown({ key: 'c', preventDefault: () => { prevented++ } })
  tree = await s.settle()
  assert.equal(s.swipes.length, 1)
  assert.equal(s.mapLayers.length, 2)
  option(tree, 'Topo').props.onKeyDown({ key: 'C', preventDefault: () => { prevented++ } })
  tree = await s.settle()
  assert.equal(s.swipes.length, 1, 'C on the compared basemap does not reload it')

  s.props.config = { ...s.props.config, basemaps: s.props.config.basemaps.filter(b => b.id !== 'map-3') }
  tree = await s.settle()
  tree = await s.settle()
  assert.equal(s.mapLayers.length, 0, 'Compare layers leave the map with their basemap')
  assert.equal(s.ui.length, 0)
  assert.equal(s.swipes[0].removed, true)
  assert.equal(headerParts(tree).compare.props['aria-pressed'], true, 'Compare stays on for a new choice')
  assert.ok(text(nodes(tree, n => n.props.className === 'compare-bar')[0]).includes('Choose a basemap'))
})
