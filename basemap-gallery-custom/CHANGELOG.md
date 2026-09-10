# Changelog

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
