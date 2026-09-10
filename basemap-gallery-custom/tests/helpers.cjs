const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
let ts
try {
  ts = require('typescript')
} catch (error) {
  throw new Error('Run the tests inside the Experience Builder client tree, where TypeScript is installed. No test libraries are required.', { cause: error })
}
const root = path.resolve(__dirname, '..')

function loader (mocks = {}, globals = {}) {
  const cache = new Map()
  function load (file) {
    let full = path.resolve(root, file)
    if (!fs.existsSync(full)) full += fs.existsSync(full + '.ts') ? '.ts' : '.tsx'
    if (cache.has(full)) return cache.get(full).exports
    const source = fs.readFileSync(full, 'utf8')
    const result = ts.transpileModule(source, {
      fileName: full,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
      reportDiagnostics: true
    })
    const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error)
    if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => '\n'
    }))
    const module = { exports: {} }
    cache.set(full, module)
    const requireLocal = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('.')) return load(path.resolve(path.dirname(full), name))
      throw new Error('Unexpected runtime dependency in test: ' + name)
    }
    const context = { module, exports: module.exports, require: requireLocal, console, ...globals }
    vm.runInNewContext(result.outputText, context, { filename: full })
    return module.exports
  }
  return load
}

function translate (messages) {
  return (id, values = {}) => {
    if (!Object.hasOwn(messages, id)) throw new Error('Unresolved translation: ' + id)
    return messages[id].replace(/\{(\w+)\}/g, (match, key) => {
      if (!Object.hasOwn(values, key)) throw new Error('Unfilled token: ' + match + ' in ' + id)
      return values[key]
    })
  }
}

// A lightweight hook/tree harness. This tests our handlers, not jimu-ui's browser implementation.
function hookHarness () {
  const values = []
  const deps = []
  let cursor = 0
  let effects = []
  let dirty = false
  const changed = (index, next) => !next || !deps[index] || next.some((v, i) => !Object.is(v, deps[index][i]))
  const React = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.flat(Infinity) } }),
    useState: initial => {
      const index = cursor++
      if (!Object.hasOwn(values, index)) values[index] = typeof initial === 'function' ? initial() : initial
      return [values[index], next => {
        const value = typeof next === 'function' ? next(values[index]) : next
        if (!Object.is(value, values[index])) { values[index] = value; dirty = true }
      }]
    },
    useEffect: (effect, next) => {
      const index = cursor++
      if (changed(index, next)) { deps[index] = next; effects.push(effect) }
    },
    useRef: initial => {
      const index = cursor++
      if (!Object.hasOwn(values, index)) values[index] = { current: initial }
      return values[index]
    },
    useMemo: (factory, next) => {
      const index = cursor++
      if (changed(index, next)) { values[index] = factory(); deps[index] = next }
      return values[index]
    }
  }
  React.useCallback = (fn, next) => React.useMemo(() => fn, next)
  const render = (component, props) => {
    for (let attempt = 0; attempt < 20; attempt++) {
      cursor = 0; effects = []; dirty = false
      const tree = component(props)
      for (const effect of effects) effect()
      if (!dirty) return tree
    }
    throw new Error('Hook test did not settle')
  }
  const mocks = {
    'jimu-core': { React, jsx: React.createElement, css: (parts, ...args) => parts.reduce((s, p, i) => s + p + (args[i] ?? ''), '') },
    'jimu-ui': Object.fromEntries(['Button', 'Modal', 'ModalHeader', 'ModalBody', 'ModalFooter', 'TextInput', 'Tooltip', 'Loading'].map(name => [name, name])),
    'calcite-components': { CalciteIcon: 'CalciteIcon', CalciteSlider: 'CalciteSlider' },
    'arcgis-map-components': {},
    'jimu-theme': { useTheme: () => ({ sys: { color: { primary: { main: 'primary' }, surface: { paper: 'surface', paperText: 'text' } } } }) },
    'jimu-arcgis': { JimuMapViewComponent: 'JimuMapViewComponent' },
    'esri/Basemap': class Basemap {},
    'esri/portal/Portal': class Portal {},
    'esri/core/Collection': class Collection { constructor (items) { this.items = items || [] } },
    'esri/core/reactiveUtils': { watch: () => ({ remove () {} }) }
  }
  return { render, mocks }
}

function nodes (tree, predicate = () => true) {
  if (Array.isArray(tree)) return tree.flatMap(value => nodes(value, predicate))
  if (!tree || typeof tree !== 'object' || !tree.props) return []
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props.children, predicate)]
}
function text (tree) {
  if (tree == null || tree === false || tree === true) return ''
  if (Array.isArray(tree)) return tree.map(text).join('')
  if (typeof tree !== 'object') return String(tree)
  return text(tree.props?.children)
}

module.exports = { root, loader, translate, hookHarness, nodes, text }
