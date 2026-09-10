# Visual Studio JSX type-file access fix: 1.20.2

## Reported error

```text
Error reading content of source file
'C:\arcgis-experience-builder-1.21\client\node_modules\@types\react\jsx-runtime.d.ts'
-- 'Access to the path ... is denied.'
```

## What was found in the delivered ZIP

The 1.20.1 widget already had the handoff's classic-JSX mode B configuration:
`jsx: "react"`, `types: []`, `noEmit: true`, and no `baseUrl`, `paths`, or
`jsxImportSource`. Changing `jsx` to the value it already had would not address
the remaining reference.

The old file `src/setting/emotion-jsx-runtime.d.ts` separately declared the
Emotion JSX runtime and re-exported `react/jsx-runtime`. That declaration was
redundant with the copied master in `src/exb-editor-shims.d.ts`. In a compiler-host
fixture with visible React package metadata but unreadable JSX declaration files,
the old settings shim made TypeScript request the blocked file. Neutralizing that
one shim removed the request. The copied master was not changed.

The fixture specifically records attempted source-file reads, not only compiler
errors. The pre-fix fixture still returned no pre-emit diagnostics with the tested
compiler and `skipLibCheck`, so an ordinary clean `tsc` result alone would miss this.

This extends the concrete installation guidance in WIDGETHANDOFF.md Section 12.3
with a separately reproduced leftover-shim case. It is not a claim that every
Visual Studio access-denied error has the same cause.

## Patch

Only one existing source file changes:

```text
src/setting/emotion-jsx-runtime.d.ts
```

It is now comments only. Do not remove it from future update ZIPs yet: copying a
ZIP over an installation does not remove old files omitted from the archive.
Shipping the inert replacement neutralizes the old file on disk.

All runtime files, `src/setting/setting.tsx`, `tsconfig.json`, the shared editor
master, and widget-specific editor declarations are unchanged from 1.20.1.
The filter and question-mark Help button remain in the same row.

## Applying the update

1. Close Visual Studio.
2. Copy the updated `basemap-gallery-custom` folder over the existing widget folder,
   replacing matching files. Do not create a second nested widget folder.
3. Delete the `.vs` folder inside this widget folder only, if present. It is the
   editor cache, not the widget source.
4. In Visual Studio, choose **File > Open > Folder** and open
   `C:\arcgis-experience-builder-1.21\client\your-extensions\widgets\basemap-gallery-custom`.
   Do not open `client` or the entire Experience Builder installation.

These cache/reopen steps come from the handoff's Section 12.3. Keep package files
and generated `client\dist` source closed while checking the widget. The handoff
also recommends **Open Documents** in the Error List and checking the File column.

No React install, permission change, parent tsconfig replacement, or alteration to
Experience Builder's build setup is part of this patch. If the same error remains
after this procedure, the active Visual Studio project and any separately opened
package files still need to be checked on the actual Windows installation.

## Tests and limits

`tests/editor-isolation.test.cjs` creates a temporary client-shaped directory,
copies only this widget's source and tsconfig, and supplies minimal package
fixtures. A TypeScript compiler-host hook simulates a denied read for React JSX
type files without changing any real filesystem permissions.

The tests establish that:

- Restoring the old shim reproduces a read of the blocked file.
- The patched source requests neither blocked React JSX type file.
- Isolation also holds when minimal React and Emotion packages are visible.
- The compatibility shim is shipped and contains no active statements.

The 25 existing tests continue to check guide content, behavior, shared components,
inline layout structure, storage handling, and release metadata. Together all 29
passed with Node 22.16.0 and TypeScript 5.8.3. `tsc -p . --noEmit` also passed.
Runtime files and the settings component were byte-compared against the 1.20.1 ZIP.

This is not a live Windows Visual Studio, pnpm-junction, or Experience Builder
webpack/browser test. No claim is made that those checks were run.
