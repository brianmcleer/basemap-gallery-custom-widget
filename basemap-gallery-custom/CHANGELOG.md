# Changelog

## 1.21.5 (2026-09-18)

- Added: anonymous usage and error telemetry (shared beacon module; off unless the portal publishes an exb-beacon-sink table; telemetry: false in config disables it).

## 1.21.4 - 2026-09-17

### Changed

- Packaging: the Visual Studio editor shims are no longer in the release zip.
  `publish.ps1` now stages a copy of the widget, removes `src/exb-editor-shims.d.ts`,
  `src/vendor-shims.d.ts`, `src/runtime/esri.d.ts` and `tests`, and zips that. The files
  stay in the GitHub repository. Their ambient `declare module` blocks are not
  file-scoped, so in a downstream `your-extensions` folder they rewrote the react, jimu
  and esri types for every other widget and flooded the type checker with errors.
- `publish.ps1` refuses to build a zip if an ambient shim survives the staging step, and
  prints one line per file it leaves out.
- README: the download step says what the zip omits, the clone step says which file to
  delete, and the install step warns that `npm i -g pnpm` run inside `client` or `server`
  can write junk dependencies into that folder's `package.json`.

### Validation

- `tsc -p .` zero errors; 34 automated tests pass.
- Release staging was simulated against the current file list: both ambient shims and the
  tests folder are removed, `manifest.json` stays directly inside the widget folder, and
  the only remaining `.d.ts` is the comments-only `src/setting/emotion-jsx-runtime.d.ts`.
- No runtime source changed in this release.


## 1.21.3 - 2026-09-10

### Added

- While a comparison is active, the current basemap card shows a "Right" badge (primary
  color) to match the "Left" badge on the compared basemap. Its aria-label and tooltip
  say so, and the guide's compare section mentions both badges.


## 1.21.2 - 2026-09-10

### Fixed

- The map could not be panned or zoomed while compare was on. The `<arcgis-swipe>` host
  added through `view.ui` received `pointer-events: auto` and covered the view. The widget
  now sets `pointer-events: none` on the host (inline, applied again on `arcgisReady`) and
  adds a stylesheet to the component's shadow root that keeps only the divider and handle
  interactive. Dragging the divider still works; the slider is unaffected.


## 1.21.1 - 2026-09-10

### Changed

- The header row (filter, Compare, Help) and the compare bar sit in a `.gallery-sticky`
  wrapper that stays visible while the gallery scrolls.
- Compare is a labeled tool button (icon plus "Compare", outlined) instead of an icon-only
  tertiary button. While compare is on it is filled and reads "Close". Both states have a
  tooltip. Titles, aria-labels, and aria-pressed are unchanged.

### Validation

- `tsc -p .` zero errors; 34 automated tests pass (header tests extended for the wrapper,
  label, button type, and sticky CSS). No live Experience Builder build was run here.


## 1.21.0 - 2026-09-10

### Added

- Compare two basemaps. A compare button in the header (Calcite `compare` icon) turns
  compare on. Choosing a basemap then loads it as map layers behind an ArcGIS Maps SDK
  `<arcgis-swipe>` divider, with the current basemap on the right. A `CalciteSlider`
  below the header and the on-map divider drive each other.
- Keyboard: C on a focused basemap compares it. Enter and Space choose the left side while
  compare is on. Screen-reader announcements for every compare state.
- A `Compare basemaps` switch in the Appearance settings (`enableCompare`, default on),
  written to and read from the XML export as `<enableCompare>`.
- Guide content: a "Compare two basemaps" section, keyboard lines, two troubleshooting
  lines while compare is on, and a Good to know line. All gated on the live compare state.
- Tests: compare guide gating across 16,384 flag combinations, and widget tests for the
  header button, slider and divider two-way position, layer add/remove/destroy, replacing
  the left side, closing compare, the C key, and the settings switch.

### Changed

- Header order is filter, compare, Help. The compare button appears only when the gallery
  is shown and compare is enabled.
- `src/vendor-shims.d.ts` declares `arcgis-map-components`, `CalciteSlider`, and
  `esri/core/Collection` for the editor-only type check.
- Test mocks cover the new shared-library imports. No runtime dependencies were added.

### Credits

- The compare idea comes from Nicholas Cramer's modified out of the box Basemap Gallery
  widget (opacity blend of two basemaps with a range slider). This release adapts it to
  a side by side divider.

### Notes

- `arcgis-slider` (`@arcgis/common-components`) was evaluated and not used: Experience
  Builder 1.21 does not externalize that package, so importing it would bundle a private
  copy. `arcgis-swipe` and Calcite are both shared externals.
- The shared HelpPopup, FirstRunHint, theme, and editor master are unchanged.

### Validation

- TypeScript 5.8.3: `tsc -p . --noEmit` passed with zero errors.
- Node 22: all 33 automated tests passed.
- A live Experience Builder build and browser check of the divider were not run here.
  See README "Compare basemaps" and docs/HELP_GUIDE.md for the live checks.


## 1.20.2 - 2026-09-10

### Fixed

- Neutralized the obsolete settings-only Emotion JSX shim. Its explicit re-export of
  `react/jsx-runtime` still caused a read of the real React JSX declaration file even
  though the widget already used classic JSX and `skipLibCheck`.
- Kept `src/setting/emotion-jsx-runtime.d.ts` as a comments-only file so overwrite
  installations replace the obsolete declaration instead of leaving it behind.

### Added

- Four editor-isolation regression tests, including a positive control that restores
  the old shim and reproduces the blocked-file read.
- Visual Studio cache/reopen instructions and a technical note in `docs/EDITOR_FIX.md`.

### Preserved

- All runtime source, shared help components, inline filter/Help layout, and settings
  component source are byte-identical to 1.20.1.
- Widget-level tsconfig, the copied editor master, vendor shims, configuration,
  dependency resolutions, and manifest exbVersion are unchanged.

### Validation

- TypeScript 5.8.3: `tsc -p . --noEmit` passed with zero errors.
- Node 22.16.0: all 29 automated tests passed.
- The old shim triggered a blocked JSX type-file read in the compiler-host fixture.
  The patched declarations made zero such reads, both with only React type files
  present and with React/Emotion packages also present.
- This is a simulated blocked-file regression, not a Windows Visual Studio or live
  Experience Builder test. Those environments were not available here.

## 1.20.1 - 2026-09-10

### Fixed

- Filter basemaps and the question-mark Help button now share one compact header row.
- The filter can shrink in narrow panels while the Help button keeps its size at the right.
- Removed the separate filter row. Help remains available when filtering is not shown.

### Preserved

- Shared HelpPopup, FirstRunHint, theme tokens, help text, and hint storage behavior.
- Existing filter threshold, search handler, gallery selection, favorites, and basemap loading.
- Builder settings, dependency declarations, editor configuration, and manifest exbVersion.

### Validation

- The local TypeScript check passed with zero errors; all 25 automated tests passed.
- Added header regressions for grid/list views, filtering, Help, and hidden-filter states.
- A real Experience Builder build and live browser layout check were not run here.

## 1.20.0 - 2026-09-10

### Added

- Top-right Help button using the shared Calcite question icon and jimu-ui guide.
- Search with match highlighting and a one-section-at-a-time accordion.
- Basemap-specific, translated help for available controls and the current loading/error state.
- Dismissible first-run hint, saved per widget and browser, with guarded storage access.
- Shared theme tokens and reference-preserving guide presentation from WIDGETHANDOFF.md.
- Automated guide-content, handler, storage, presentation-consistency, and packaging tests.

### Changed

- Widget, package, and npm lockfile root version metadata now agree at 1.20.0.
- Search, favorite, and active-basemap labels now read identical wording from translations.
- Editor-only TypeScript configuration uses the handoff's self-contained classic-JSX setup.
- The shared editor shim is copied unchanged from the published Property Report reference.
- Existing runtime and settings JSX receive explicit Emotion JSX and React.Fragment pragmas.
- Settings props use the handoff's local structural type. Settings logic is unchanged.

### Preserved

- Basemap loading, TileLayer warm-up, default-basemap application, selection, and map watching.
- Favorites storage and ordering, search threshold, keyboard navigation, and gallery CSS.
- Existing configuration schema, default config, widget name, and manifest exbVersion.
- Existing dependency resolutions. Only stale root-version metadata in package-lock.json changed.

### Validation

- TypeScript 5.8.3: `tsc -p .` passed with zero errors using editor-only declarations.
- Node 22.16.0: all 21 automated tests passed, including content checks for 4,096 flag combinations.
- Guide and theme hashes match the supplied Markdown's code blocks.
- The shared editor shim matches the fetched reference's Git blob ID.
- Original gallery logic/CSS, settings component body, and default config compared unchanged.
- A real Experience Builder webpack build and live desktop/mobile app test were not available here.
