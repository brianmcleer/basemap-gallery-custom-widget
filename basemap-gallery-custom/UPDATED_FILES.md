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

## 1.22.0

Basemaps by service URL.

- New: `src/runtime/basemapSource.ts` (pure helpers, no esri imports; imported by both
  runtime and settings), `src/runtime/basemapFactory.ts` (portal item or URL to Basemap),
  `tests/basemap-url.test.cjs`.
- `src/runtime/widget.tsx`: loads every entry through the factory, keeps the source entry
  on each loaded basemap, recognizes URL basemaps through `Basemap.id` (`basemapKey`),
  compare builds a fresh layer from the URL, `window.location` guarded on module load.
- `src/setting/setting.tsx`: Add Basemap from URL section, service probe with plain
  `fetch`, URL badge and layer type in Selected Basemaps, `<url>` and `<layerType>` in
  the XML export and import.
- `src/setting/translations/default.ts`: 24 new strings (run `exb-i18n sync` before publish).
- `tests/helpers.cjs`: layer class doubles for every `esri/layers/*` module the factory
  imports. `tests/help-ui.test.cjs`, `tests/editor-isolation.test.cjs`,
  `tests/help-consistency.test.cjs`: assertions brought up to the current widget.
- `README.md`, `CHANGELOG.md`, `UPDATED_FILES.md`, `package.json` (test script),
  `manifest.json`, `package-lock.json`: version 1.22.0.

## 1.23.0

Edit in place and thumbnails from a file.

- `src/setting/setting.tsx`: pencil on each Selected Basemaps card with an inline edit
  form, Choose image on both forms (canvas resize to a data URL), shared
  `resolveServiceUrl` for add and edit.
- `src/runtime/basemapSource.ts`: `coverCrop`, `normalizeThumbnailUrl`, `isDataImageUrl`,
  card size constants.
- `src/runtime/widget.tsx`: configured title and thumbnail win over the portal item's.
- `src/setting/translations/default.ts`: 13 new strings (run `exb-i18n sync`).
- `tests/basemap-url.test.cjs`: 4 new tests.
- `README.md`, `CHANGELOG.md`, `UPDATED_FILES.md`, version files: 1.23.0.
