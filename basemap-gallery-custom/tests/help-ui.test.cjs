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
  return { header, help: help[0], inputs: nodes(header, n => n.type === 'TextInput') }
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
    assert.equal(children.length, 2)
    assert.equal(children[0].props.className, 'search-container')
    assert.equal(children[1], parts.help, 'Help sits to the right of the filter')
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
  assert.equal(parts.header.props.children.filter(n => n && typeof n === 'object').length, 1)
  parts.help.props.onClick()
  assert.equal(nodes(s.render(), n => n.type === s.Help)[0].props.open, true)
})

test('Loading and disconnected views retain Help without a stale filter', async () => {
  const s = await headerGallery(9)
  assert.equal(headerParts(s.loadingTree).inputs.length, 0)
  assert.equal(headerParts(s.render()).inputs.length, 1)
  nodes(s.render(), n => n.type === 'JimuMapViewComponent')[0].props.onActiveViewChange(null)
  const parts = headerParts(s.render())
  assert.equal(parts.inputs.length, 0)
  parts.help.props.onClick()
  assert.equal(nodes(s.render(), n => n.type === s.Help)[0].props.open, true)
})
