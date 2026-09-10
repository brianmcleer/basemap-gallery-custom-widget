# Files in the 1.20.2 JSX access fix

This ZIP contains the complete widget. Copy its `basemap-gallery-custom` folder
over the existing widget folder, replacing matching files. Do not nest it inside
another folder of the same name or install a second widget copy.

Changes below are relative to the previously supplied 1.20.1 inline Help ZIP.

## Editor-only source change

- `src/setting/emotion-jsx-runtime.d.ts`: replaced the redundant JSX-runtime
  re-export with comments. The file stays present so an overwrite update disables
  the old declaration. It emits no JavaScript.

## New test and documentation

- `tests/editor-isolation.test.cjs`
- `docs/EDITOR_FIX.md`

## Updated documentation and release metadata

- `README.md`
- `CHANGELOG.md`
- `UPDATED_FILES.md`
- `manifest.json`
- `package.json`: version plus the new test in the existing test command.
- `package-lock.json`: root version metadata only.

All runtime source files and `src/setting/setting.tsx` are byte-identical to 1.20.1.
`tsconfig.json`, the shared editor master, vendor shims, config, dependency
resolutions, and pnpm lockfile are also unchanged. The filter and Help button
remain in the same row. No new libraries were added.

After copying the files, clear only this widget's `.vs` cache with Visual Studio
closed, then reopen the widget folder directly. See `docs/EDITOR_FIX.md`.
