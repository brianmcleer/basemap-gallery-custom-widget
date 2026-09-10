# Help guide maintenance

## Files and source of truth

- `src/runtime/components/HelpPopup.tsx`: verbatim presentation from WIDGETHANDOFF.md Section 10.3.
- `src/runtime/theme.ts`: verbatim tokens from Section 11.2.
- `src/runtime/components/FirstRunHint.tsx`: function wrapper around the unchanged Section 10.5 banner markup.
- `src/runtime/helpSections.ts`: this widget's section order and feature-gated content.
- `src/runtime/translations/default.ts`: help/hint text and the existing control labels reused by the guide.
- `src/runtime/helpHint.ts`: guarded, per-widget browser-storage access.
- `src/runtime/widget.tsx`: shared top-right Help button, hint state, and computed help flags.

No independent Droplets source was supplied or available in the Library. The guide and
theme are copied from the complete reference code included in the supplied handoff, and
the tests compare those exact code blocks. They do not claim a separate live comparison
against the Droplets repository.

The editor master was fetched from the published Property Report reference named in the handoff:
`brianmcleer/property-report-widget`, path `property-report/src/exb-editor-shims.d.ts`.
Its Git blob ID is `922bef363125c79bdf7ac022621c72979cd06cd0`.
The copied file is byte-identical. The classic-JSX global namespace and this widget's
additional ambient declarations live separately in `src/vendor-shims.d.ts`.

## Header layout

The filter box and Help button share `.gallery-header`, a single non-wrapping flex row.
The filter wrapper can shrink (`flex: 1 1 0%`, `min-width: 0`); the Help button keeps its
size (`flexShrink: 0`). Only the filter is gated by `showGallery && showSearch`, so Help
remains available while loading, for small galleries, and in empty or error states.
The first-run hint remains below this shared row. Keep the filter in the header rather
than reintroducing a second search row above the cards.

## Feature checks

The widget computes `showGallery` once, using the existing gallery-render condition, and
uses it both to render the gallery and to build the guide flags. Search uses the original
`showSearch` check (`loadedBasemaps.length > 8`). List/grid instructions follow `displayMode`.
Favorites are described only when the gallery is available. Default-basemap text requires
the configured default to be loaded. Active-marker text requires a visible active item.
Loading, empty, error, partial failure, and missing-preview lines use the corresponding
live state. Start here always has three steps appropriate to the current state.

The guide has no XML import/export instructions because those controls belong to the
builder settings, not the end-user gallery. No new builder settings or config flags were added.

## Editing the guide

Change the `help*` strings and `buildHelpSections`, not the shared modal or theme files.
Keep Help, Close, New here?, and Open the guide. consistent with the handoff. Reuse the
same translation key when the guide names a runtime control. After an edit, run both the
tests and the TypeScript check from the README. A change to shared presentation must be
made deliberately across the widget family before updating the reference hashes.

The consistency suite has a `WIDGETS` list containing this widget. Additional installed
widget paths can be added there. The source and consistency test use the supplied
Markdown as their current guide reference.

## Test scope

The local suite uses Node's test runner and the TypeScript compiler already in the
Experience Builder development tree, instead of adding Jest packages and changing
lockfile dependencies. Its lightweight hook/tree mocks test our handlers and returned
component props. They do not render the real jimu-ui Modal, run ArcGIS services, measure
browser layout, or validate assistive-technology behavior.

The copied editor declarations are intentionally permissive. Passing `tsc -p .` checks
source syntax and the local editor types; it does not substitute for the real Experience
Builder webpack compiler and runtime.

## Live checks before deployment

1. Restart the Experience Builder client, verify webpack compiles, and open the existing app.
2. Check the Help button, first-run hint, and scrolling at desktop and phone portrait/landscape sizes.
   Confirm the filter box and Help button stay on the same row without horizontal overflow.
3. Open Help, expand sections, search for map, favorites, and filter, try an unmatched word,
   then close and reopen the guide. Confirm the search resets.
4. Test keyboard focus, Escape/backdrop/header/footer closing, and focus returning to the
   opening control with the real jimu-ui Modal. Confirm screen-reader labels and announcements.
5. Dismiss the hint, reload, and confirm it stays hidden. Repeat in a second widget and in
   a browser with storage blocked. Confirm favorites are unchanged.
6. Test grid/list layouts, galleries with eight and nine loaded basemaps, no connected map,
   no configured basemaps, and a partially failed gallery. The guide must match visible controls.
7. Switch basemaps, star items, use the keyboard, and confirm the existing cache, default,
   and selection behavior is unchanged. Review browser network/console output.
8. Review the guide in the app's light and dark themes. Build and redeploy the app through
   the normal workflow only after these checks pass.
