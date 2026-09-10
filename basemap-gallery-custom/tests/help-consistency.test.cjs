const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { root } = require('./helpers.cjs')

// Add sibling widgets here when running this suite across the installed family.
const WIDGETS = [root]
const EXPECTED = {
  'src/runtime/components/HelpPopup.tsx': 'bf25e9d01b185c5f2b582a1a1cc3d028ffb1446955f4f9885871ad7661bede06',
  'src/runtime/theme.ts': '770c10b409ecc967eafe9e0744a1f4a759f05b834b8494aa4d9452bd43dc2ade'
}
const normalized = text => text.replace(/\r\n/g, '\n')

for (const widget of WIDGETS) {
  test(path.basename(widget) + ': shared presentation matches the supplied Markdown verbatim', () => {
    for (const [file, expected] of Object.entries(EXPECTED)) {
      const source = normalized(fs.readFileSync(path.join(widget, file), 'utf8'))
      assert.equal(crypto.createHash('sha256').update(source).digest('hex'), expected, file)
    }
  })
}

test('The shared editor master is identical to its fetched Property Report source', () => {
  const data = fs.readFileSync(path.join(root, 'src/exb-editor-shims.d.ts'))
  const hash = crypto.createHash('sha1').update(Buffer.from('blob ' + data.length + '\0')).update(data).digest('hex')
  assert.equal(hash, '922bef363125c79bdf7ac022621c72979cd06cd0')
})

test('Guide and hint use theme tokens, Calcite icons, and accessible shared controls', () => {
  for (const file of ['HelpPopup.tsx', 'FirstRunHint.tsx']) {
    const source = fs.readFileSync(path.join(root, 'src/runtime/components', file), 'utf8')
    assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|<svg\b/i)
    assert.match(source, /useTokens\(\)/)
    assert.match(source, /CalciteIcon/)
  }
  const widget = fs.readFileSync(path.join(root, 'src/runtime/widget.tsx'), 'utf8')
  assert.match(widget, /<Button size="sm" type="tertiary" icon onClick=\{onHelp\} title=\{t\('helpTitle'\)\} aria-label=\{t\('helpTitle'\)\} style=\{\{ flexShrink: 0 \}\}>/)
  assert.match(widget, /<CalciteIcon icon="question" scale="s" \/>/)
  const hint = fs.readFileSync(path.join(root, 'src/runtime/components/FirstRunHint.tsx'), 'utf8')
  assert.match(hint, /role="note"/)
  assert.match(hint, /borderLeft: `3px solid \$\{tokens.primary\}`/)
  assert.match(hint, /aria-label=\{t\('firstRunDismiss'\)\}/)
})

test('Help uses the actual gallery visibility and the original search threshold', () => {
  const source = fs.readFileSync(path.join(root, 'src/runtime/widget.tsx'), 'utf8')
  assert.match(source, /const SEARCH_THRESHOLD = 8/)
  assert.match(source, /const showSearch = loadedBasemaps.length > SEARCH_THRESHOLD/)
  assert.match(source, /search: showGallery && showSearch/)
  assert.match(source, /favorites: showGallery/)
  assert.match(source, /\{showGallery && \(/)
})

test('Editor configuration is self-contained classic JSX, with no runtime dependency additions', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8')).compilerOptions
  assert.equal(config.jsx, 'react')
  assert.equal(config.noEmit, true)
  assert.deepEqual(config.types, [])
  assert.ok(!('paths' in config) && !('baseUrl' in config) && !('jsxImportSource' in config))
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  assert.deepEqual(pkg.dependencies, {})
  for (const file of ['src/runtime/widget.tsx', 'src/setting/setting.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /\/\*\* @jsx jsx \*\//)
    assert.match(source, /import \{ React, (?:ImmutableObject, )?jsx, (?:ImmutableObject, )?css \}/)
  }
})

test('Release metadata is synchronized', () => {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))
  const version = read('manifest.json').version
  assert.equal(read('package.json').version, version)
  assert.equal(read('package-lock.json').version, version)
  assert.equal(read('package-lock.json').packages[''].version, version)
})
