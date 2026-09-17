# Files in the 1.21.0 compare update

This ZIP contains the complete widget. Copy its `basemap-gallery-custom` folder
over the existing widget folder, replacing matching files. Do not nest it inside
another folder of the same name or install a second widget copy.

Changes below are relative to 1.20.2.

## Runtime source

- `src/runtime/widget.tsx`: compare button, compare bar with `CalciteSlider`,
  `<arcgis-swipe>` overlay lifecycle, C key, badges, announcements, guide flags.
- `src/runtime/helpSections.ts`: `compare` and `comparing` flags and the new section.
- `src/runtime/translations/default.ts`: compare control labels and guide text.

## Settings source

- `src/setting/setting.tsx`: `Compare basemaps` switch and `<enableCompare>` XML
  export and import.

## Editor-only declarations

- `src/vendor-shims.d.ts`: `arcgis-map-components`, `CalciteSlider`, `esri/core/Collection`.

## Tests

- `tests/helpers.cjs`: mocks for the new shared-library imports.
- `tests/help-content.test.cjs`: new flags and a compare gating test.
- `tests/help-ui.test.cjs`: header order and three compare behavior tests.

## Configuration, documentation, and release metadata

- `config.json`: `enableCompare: true` default.
- `README.md`, `CHANGELOG.md`, `UPDATED_FILES.md`, `docs/HELP_GUIDE.md`
- `manifest.json`, `package.json`, `package-lock.json`: version 1.21.0.

Unchanged: `src/runtime/components/*`, `src/runtime/theme.ts`, `src/runtime/helpHint.ts`,
`src/exb-editor-shims.d.ts`, `src/setting/emotion-jsx-runtime.d.ts`, `tsconfig.json`,
`tests/help-consistency.test.cjs`, `tests/editor-isolation.test.cjs`, `docs/EDITOR_FIX.md`,
and the manifest `exbVersion`. No new libraries were added.

## 1.21.1

- `src/runtime/widget.tsx`: sticky `.gallery-sticky` wrapper; labeled Compare button.
- `src/runtime/translations/default.ts`: `compareOnShort`, `compareOffShort`, tooltips.
- `tests/help-ui.test.cjs`, `README.md`, `CHANGELOG.md`, `docs/HELP_GUIDE.md`, version files.

## 1.21.2

- `src/runtime/widget.tsx`: `letMapEventsThroughSwipe` so the divider no longer blocks pan and zoom.
- `tests/help-ui.test.cjs`, `README.md`, `CHANGELOG.md`, version files.

## 1.21.3

- `src/runtime/widget.tsx`, `src/runtime/translations/default.ts`: Right badge on the current basemap while comparing.
- `tests/help-ui.test.cjs`, `README.md`, `CHANGELOG.md`, version files.

## 1.21.4

Packaging only. No runtime source changed.

- `publish.ps1` (repo root, not in the widget folder): `$ReleaseOnlyExclude` strips the
  editor shims and `tests` from the release zip, with a guard that fails the run if an
  ambient shim survives.
- `README.md`: zip contents note, clone note, pnpm install caution, developer checks.
- `CHANGELOG.md`, `UPDATED_FILES.md`, `manifest.json`, `package.json`,
  `package-lock.json`: version 1.21.4.
