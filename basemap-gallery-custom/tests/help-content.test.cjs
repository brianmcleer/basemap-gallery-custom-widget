const test = require('node:test')
const assert = require('node:assert/strict')
const { loader, translate } = require('./helpers.cjs')
const load = loader()
const messages = load('src/runtime/translations/default.ts').default
const { buildHelpSections } = load('src/runtime/helpSections.ts')
const t = translate(messages)
const flags = ['mapConnected', 'galleryAvailable', 'listView', 'search', 'favorites', 'defaultBasemap', 'activeIndicator', 'loading', 'empty', 'loadError', 'partialFailure', 'missingThumbnail']
const base = Object.fromEntries(flags.map(key => [key, false]))
const ready = { ...base, mapConnected: true, galleryAvailable: true, favorites: true }
const content = sections => sections.map(s => [s.title, s.intro || '', ...s.body].join('\n')).join('\n')

test('All 4,096 flag combinations resolve strings and obey writing/section rules', () => {
  for (let mask = 0; mask < 2 ** flags.length; mask++) {
    const features = Object.fromEntries(flags.map((key, index) => [key, Boolean(mask & (1 << index))]))
    const sections = buildHelpSections(t, features)
    assert.equal(sections[0].key, 'start')
    assert.equal(sections[0].body.length, 3)
    assert.equal(sections.at(-2).key, 'trouble')
    assert.equal(sections.at(-1).key, 'tips')
    assert.equal(new Set(sections.map(s => s.key)).size, sections.length)
    assert.equal(new Set(sections.map(s => s.icon)).size, sections.length)
    assert.ok(sections.every(s => s.body.length && s.body.every(Boolean)))
    assert.ok(sections.every(s => Boolean(s.ordered) === (s.key === 'start')))
    const all = content(sections)
    assert.doesNotMatch(all, /\{\w+\}|[\u2013\u2014]/)
    assert.doesNotMatch(all, /\b(instance|session|persist|sync|toggle|modal)\b/i)
    const trouble = sections.find(s => s.key === 'trouble').body
    assert.equal(trouble.at(-1), messages.helpTroubleContact)
    assert.ok(trouble.slice(0, -1).every(line => line.includes(':') && line.endsWith('.')))
  }
})

test('Optional controls disappear from the guide when unavailable', () => {
  const allOff = content(buildHelpSections(t, base))
  for (const word of ['favorites', 'Filter basemaps...', 'Press F', 'Press Enter', 'chosen basemap', 'picture is missing']) {
    assert.ok(!allOff.toLowerCase().includes(word.toLowerCase()), word)
  }
  const noSearch = content(buildHelpSections(t, ready))
  assert.ok(!noSearch.includes(messages.filterPlaceholder))
  assert.equal(buildHelpSections(t, { ...ready, search: true }).some(s => s.key === 'organize'), true)
  const noFavorites = content(buildHelpSections(t, { ...ready, favorites: false }))
  assert.doesNotMatch(noFavorites, /favorites|Press F|stars/i)
})

test('Each individual optional flag adds exactly its intended guidance', () => {
  const mapping = {
    search: ['helpOrganizeFilter', { filterLabel: messages.filterPlaceholder }],
    favorites: ['helpFavoritesAdd', { addLabel: messages.favoriteAdd }],
    defaultBasemap: ['helpUseDefault'], activeIndicator: ['helpUseIndicator', { activeLabel: messages.activeBasemapLabel }],
    loading: ['helpTroubleLoading'], empty: ['helpTroubleEmpty'], loadError: ['helpTroubleLoadError'],
    partialFailure: ['helpTroublePartial'], missingThumbnail: ['helpTroubleThumbnail']
  }
  for (const [flag, [id, values]] of Object.entries(mapping)) {
    const expected = t(id, values)
    assert.ok(content(buildHelpSections(t, { ...ready, [flag]: true })).includes(expected), flag + ' on')
    assert.ok(!content(buildHelpSections(t, { ...ready, [flag]: false })).includes(expected), flag + ' off')
  }
})

test('Grid and list instructions match the chosen layout', () => {
  const grid = content(buildHelpSections(t, ready))
  const list = content(buildHelpSections(t, { ...ready, listView: true }))
  assert.ok(grid.includes(messages.helpStartGrid))
  assert.ok(grid.includes(messages.helpKeyboardGrid))
  assert.ok(!grid.includes(messages.helpKeyboardList))
  assert.ok(list.includes(messages.helpStartList))
  assert.ok(list.includes(messages.helpKeyboardList))
  assert.ok(!list.includes(messages.helpKeyboardGrid))
})

test('Start here follows no-map, loading, empty, failed, and ready states', () => {
  const cases = [
    [base, 'helpStartNoMap1'], [{ ...base, mapConnected: true, loading: true }, 'helpStartLoading1'],
    [{ ...base, mapConnected: true, empty: true }, 'helpStartEmpty1'],
    [{ ...base, mapConnected: true, loadError: true }, 'helpStartError1'], [ready, 'helpStartGrid']
  ]
  for (const [features, id] of cases) assert.equal(buildHelpSections(t, features)[0].body[0], messages[id])
})

test('Shared strings and control names retain the playbook wording', () => {
  assert.equal(messages.helpTitle, 'Help')
  assert.equal(messages.close, 'Close')
  assert.equal(messages.firstRunTitle, 'New here?')
  assert.equal(messages.firstRunHelpLink, 'Open the guide.')
  assert.equal(messages.helpAnd, 'and')
  assert.match(messages.helpSearchPlaceholder, /^Search the guide \(try "[^"]+" or "[^"]+"\)$/)
  const all = content(buildHelpSections(t, { ...ready, search: true, activeIndicator: true }))
  for (const id of ['filterPlaceholder', 'favoriteAdd', 'favoriteRemove', 'activeBasemapLabel', 'helpTitle', 'close']) assert.ok(all.includes(messages[id]), id)
})

test('Ordinary search terms occur in the enabled guide', () => {
  const all = content(buildHelpSections(t, { ...ready, search: true })).toLowerCase()
  for (const word of ['map', 'help', 'favorites', 'star', 'keyboard', 'filter', 'blank']) assert.ok(all.includes(word), word)
})

test('Hint dismissal is per-widget and does not overwrite favorites', () => {
  const values = new Map([['bgc-favorites-one', '["basemap-a"]']])
  const hint = loader({}, { window: { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } } })('src/runtime/helpHint.ts')
  assert.equal(hint.isHelpHintDismissed('one'), false)
  hint.dismissHelpHint('one')
  assert.equal(hint.isHelpHintDismissed('one'), true)
  assert.equal(hint.isHelpHintDismissed('two'), false)
  assert.equal(values.get('bgc-favorites-one'), '["basemap-a"]')
  assert.equal(hint.helpHintKey('one'), 'basemapGalleryCustom.helpHintDismissed.one')
})

test('Missing window and blocked localStorage reads/writes do not throw', () => {
  const environments = [{}, { window: { get localStorage () { throw new Error('Storage blocked') } } }, { window: { localStorage: { getItem () { throw new Error('Read blocked') }, setItem () { throw new Error('Write blocked') } } } }]
  for (const globals of environments) {
    const hint = loader({}, globals)('src/runtime/helpHint.ts')
    assert.equal(hint.isHelpHintDismissed('one'), false)
    assert.doesNotThrow(() => hint.dismissHelpHint('one'))
  }
})
