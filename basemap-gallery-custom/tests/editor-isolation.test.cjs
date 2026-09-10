const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')
const { root } = require('./helpers.cjs')

// A local tsc run without React packages cannot expose a blocked pnpm type file.
// Give the compiler a package it can locate, then deny reading its JSX types.
// Only the compiler host is changed: this does not modify Windows permissions,
// the real Experience Builder node_modules, or any source in the installed widget.
function checkWithBlockedJsxTypes ({ restoreLegacyShim = false, includeReactPackage = false } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'basemap-editor-'))
  const client = path.join(temp, 'client')
  const widget = path.join(client, 'your-extensions', 'widgets', 'basemap-gallery-custom')
  const write = (file, text) => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text, 'utf8')
  }
  try {
    fs.mkdirSync(widget, { recursive: true })
    fs.cpSync(path.join(root, 'src'), path.join(widget, 'src'), { recursive: true })
    fs.copyFileSync(path.join(root, 'tsconfig.json'), path.join(widget, 'tsconfig.json'))
    if (restoreLegacyShim) {
      write(path.join(widget, 'src/setting/emotion-jsx-runtime.d.ts'),
        "declare module '@emotion/react/jsx-runtime' {\n  export * from 'react/jsx-runtime'\n}\n")
    }

    const typeRoot = path.join(client, 'node_modules', '@types', 'react')
    write(path.join(typeRoot, 'package.json'), JSON.stringify({ name: '@types/react', version: '19.0.0', types: 'index.d.ts' }))
    write(path.join(typeRoot, 'index.d.ts'), 'export {}\n')
    for (const file of ['jsx-runtime.d.ts', 'jsx-dev-runtime.d.ts']) write(path.join(typeRoot, file), 'export {}\n')

    if (includeReactPackage) {
      const reactRoot = path.join(client, 'node_modules', 'react')
      write(path.join(reactRoot, 'package.json'), JSON.stringify({ name: 'react', version: '19.0.0', main: 'index.js' }))
      for (const file of ['index.js', 'jsx-runtime.js', 'jsx-dev-runtime.js']) write(path.join(reactRoot, file), 'module.exports = {}\n')
      const emotionRoot = path.join(client, 'node_modules', '@emotion', 'react')
      write(path.join(emotionRoot, 'package.json'), JSON.stringify({
        name: '@emotion/react', version: '11.0.0', types: 'index.d.ts'
      }))
      write(path.join(emotionRoot, 'index.d.ts'), 'export {}\n')
      write(path.join(emotionRoot, 'jsx-runtime.d.ts'), "export * from 'react/jsx-runtime'\n")
      write(path.join(emotionRoot, 'jsx-dev-runtime.d.ts'), "export * from 'react/jsx-dev-runtime'\n")
    }

    const configFile = path.join(widget, 'tsconfig.json')
    const config = ts.readConfigFile(configFile, ts.sys.readFile)
    assert.equal(config.error, undefined)
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, widget)
    assert.equal(parsed.errors.length, 0)
    assert.equal(parsed.options.jsx, ts.JsxEmit.React)
    assert.equal(parsed.options.skipLibCheck, true)
    const host = ts.createCompilerHost(parsed.options)
    const readSource = host.getSourceFile.bind(host)
    const blockedReads = []
    host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
      if (/[/\\]node_modules[/\\]@types[/\\]react[/\\]jsx(?:-dev)?-runtime\.d\.ts$/.test(file)) {
        blockedReads.push(path.relative(temp, file).replace(/\\/g, '/'))
        if (onError) onError('Access to the path is denied (simulated)')
        return undefined
      }
      return readSource(file, languageVersion, onError, shouldCreateNewSourceFile)
    }
    const program = ts.createProgram(parsed.fileNames, parsed.options, host)
    const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error)
    const errorText = ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: f => f, getCurrentDirectory: () => temp, getNewLine: () => '\n'
    })
    const packageSources = program.getSourceFiles()
      .filter(source => source.fileName.startsWith(path.join(client, 'node_modules')))
      .map(source => path.relative(temp, source.fileName).replace(/\\/g, '/'))
    return { blockedReads, errors, errorText, packageSources }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

test('Regression fixture reproduces the old shim read even with classic JSX and skipLibCheck', () => {
  const result = checkWithBlockedJsxTypes({ restoreLegacyShim: true })
  assert.ok(result.blockedReads.some(file => file.endsWith('@types/react/jsx-runtime.d.ts')),
    'The fixture must reproduce the pre-fix read, or it is not testing this regression.')
})

test('Fixed editor declarations never read the blocked React JSX type files', () => {
  const result = checkWithBlockedJsxTypes()
  assert.deepEqual(result.blockedReads, [])
  assert.equal(result.errors.length, 0, result.errorText)
  assert.deepEqual(result.packageSources, [])
})

test('Fixed editor declarations stay isolated when React and Emotion packages are also visible', () => {
  const result = checkWithBlockedJsxTypes({ includeReactPackage: true })
  assert.deepEqual(result.blockedReads, [])
  assert.equal(result.errors.length, 0, result.errorText)
  assert.deepEqual(result.packageSources, [])
})

test('The obsolete shim is shipped as comments so overwrite upgrades neutralize the old file', () => {
  const file = path.join(root, 'src/setting/emotion-jsx-runtime.d.ts')
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  assert.equal(source.statements.length, 0, 'No imports, re-exports or duplicate ambient modules belong here.')
})
