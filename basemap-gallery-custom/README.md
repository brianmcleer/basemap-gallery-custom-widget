# Basemap Gallery Custom Widget

A custom widget for ArcGIS Experience Builder that extends the out of the box Basemap
Gallery with additional configuration for developers.

## Features

- In-widget Help with a searchable guide, one open section at a time, and a dismissible
  first-run hint. The guide describes the controls and messages currently available.
- Display basemaps as thumbnails or as a list
- Five size settings for the list and thumbnail layouts
- Import and export XML files to transfer widget settings across applications
- Reorder the basemaps in the list
- Set a default basemap that is applied to the map on application load
- The filter, Compare and Help row (and the compare bar) stay pinned at the top while
  the gallery scrolls
- Compare two basemaps: a labeled Compare button places a second basemap behind an ArcGIS Maps SDK
  `arcgis-swipe` divider on the map. A slider in the widget and the on-map divider stay in
  step. The current basemap stays on the right; the chosen one shows on the left. The
  control can be switched off in the widget settings and is carried in the XML export
- Favorites: star a basemap to pin it to the top of the gallery. Favorites persist per
  browser, and keyboard users can press F on a focused basemap to toggle it
- Search box to filter basemaps by name, shown automatically for galleries with more
  than 8 basemaps
- Live sync: the active indicator stays correct even when the basemap is changed by
  another widget, a bookmark, or the out of the box gallery, and the gallery scrolls
  the active basemap into view
- Fast loading: basemaps load in parallel, skeleton placeholders show while they load,
  and one bad item ID no longer blocks the rest (a notice reports any items that failed)
- WCAG compliant: full keyboard navigation with row aware arrow keys in grid view,
  screen reader announcements for every state change, visible focus indicators, and
  reduced motion support

## In-widget help

Use the question-mark button at the top right of the widget, beside the filter box when
filtering is available. Both controls share one row. The guide covers choosing a basemap,
favorites, comparing two basemaps, filtering, keyboard shortcuts, saved choices, and troubleshooting.
Only applicable sections and lines appear. For example, filtering instructions appear
only when the gallery's existing search box appears, with more than eight loaded basemaps.
The guide remains available when the map is missing or basemaps cannot load.

The **New here?** hint links to the same guide. Opening the guide or dismissing the hint
remembers that choice for this widget in this browser. Blocked browser storage does not
prevent the guide or gallery from working. The new hint uses
`basemapGalleryCustom.helpHintDismissed.<widgetId>` and leaves the existing
`bgc-favorites-<widgetId>` values untouched.

`HelpPopup.tsx` and `theme.ts` are copied verbatim from Sections 10.3 and 11.2 of the supplied
`WIDGETHANDOFF.md`. The button and banner use its Section 10.5 markup. The guide introduces
no runtime dependencies. Its text is in `src/runtime/translations/default.ts`, and its
feature-gated sections are in `src/runtime/helpSections.ts`.

### Updating an existing installation

Stop the Experience Builder client. Copy the contents of this ZIP's `basemap-gallery-custom`
folder over the existing widget folder, replacing matching files. Do not put a second
`basemap-gallery-custom` folder inside it, and do not leave a renamed backup widget in
`your-extensions/widgets`. Start the client again and refresh the app. Existing configured
basemaps and the existing favorites storage key are unchanged.

Version **1.21.3** is the widget release number, not a change to the Experience Builder
version field. The manifest's existing `exbVersion` value is unchanged. This update does not
add a library that needs a separate installation.

## Keyboard reference

- Tab: move focus into the gallery
- Arrow keys: move between basemaps (up and down move by row in grid view)
- Enter or Space: apply the focused basemap to the map
- F: add or remove the focused basemap from favorites
- C: compare the focused basemap with the current basemap (turns compare on)
- Home / End: jump to the first or last basemap
- While compare is on, Enter or Space chooses the left-side basemap instead of applying it,
  and the slider below the header takes arrow keys to move the divider

## Requirements

- ArcGIS Experience Builder Developer Edition 1.19, 1.20, or 1.21 (all run React 19).
- Experience Builder 1.18 and earlier run React 18 and are not supported.

## Installation

1. Download the widget and unzip it.
2. Copy the `basemap-gallery-custom` folder into your Experience Builder install so that
   the path looks exactly like this:

   ```
   client\your-extensions\widgets\basemap-gallery-custom\manifest.json
   ```

   The `manifest.json` must sit directly inside the `basemap-gallery-custom` folder. Do
   not nest it a second level deep (for example
   `widgets\basemap-gallery-custom\basemap-gallery-custom`). Nesting is the most common
   install mistake and it stops the widget from being registered.
3. Install dependencies from a terminal in the `client` folder. The command depends on
   your Experience Builder version:
   - **1.19 and 1.20:** run `npm install`
   - **1.21 and newer:** Esri switched dependency installs to pnpm. Running `npm install`
     or `npm ci` will error. Instead run `npm i -g pnpm` once, then `pnpm ci` in the
     `client` folder (and in the `server` folder for a fresh install).

   Experience Builder installs any widget dependencies automatically during this step.
   This widget has no third party dependencies, so nothing extra is pulled in either way.
4. Start the client with `npm start`. Watch the Entrypoint list as the build runs and
   confirm that `basemap-gallery-custom` appears.
5. Add the widget to an experience from the Insert widget panel.

## Compare basemaps

Compare uses two shared Experience Builder libraries and adds nothing to the widget bundle:

- `arcgis-map-components` (the `<arcgis-swipe>` component) draws the divider on the map.
  The chosen basemap's base and reference layers are added to the map beneath the
  operational layers and assigned to the divider's start (left) side. The map's own
  basemap remains on the right.
- `calcite-components` (`CalciteSlider`) provides the slider in the widget. Moving the
  slider sets the divider position; dragging the divider updates the slider.

The compare feature is based on an idea by Nicholas Cramer, whose modified out of the box
Basemap Gallery widget added a compare mode that blends two basemaps by layer opacity with
a range slider. This widget keeps that enter/exit flow and slider bar but shows the two
basemaps side by side behind a draggable divider rather than crossfading them, so labels
and imagery stay readable on both sides.

`arcgis-slider` from `@arcgis/common-components` was considered and not used. Experience
Builder 1.21 externalizes `@arcgis/map-components`, `@arcgis/charts-components`, and
Calcite, but not `@arcgis/common-components`, so importing `arcgis-slider` would bundle
a private copy of that library into the widget.

Closing compare removes the extra layers and the divider and leaves the map on its
current basemap. Compare never changes the saved web map. The **Compare basemaps**
switch in the Appearance settings hides the control; exported XML includes
`<enableCompare>false</enableCompare>` only when it is off.

## Notes

- Favorites are stored in the browser (localStorage) per widget, so they are personal to
  each user and each browser. Clearing browser data clears favorites.
- The default basemap is applied once when the map loads. After that the widget never
  overrides a basemap the user has chosen.

## Troubleshooting

### Build reports `basemap-gallery-custom is duplicated`

Experience Builder throws this when it scans `your-extensions\widgets` and finds the same
manifest `name` registered more than once. A single, correctly placed copy of this widget
cannot duplicate itself, so a second copy is present somewhere. Check these in order:

1. A nested copy at `widgets\basemap-gallery-custom\basemap-gallery-custom`. Flatten it so
   the manifest sits one level up.
2. A leftover folder from an earlier build or version, including any `-copy` folder.
3. A stale compiled build under `client\dist\widgets`. Stop the client server, delete the
   matching folder in `dist\widgets` (or run a clean build), then start again.

If you remove a copy and the widget then disappears from the Entrypoint list entirely, the
copy you kept is nested too deep. Move it so the manifest is directly inside the
`basemap-gallery-custom` folder.

### Visual Studio cannot read `@types/react/jsx-runtime.d.ts`

Version 1.20.2 neutralizes the obsolete `src/setting/emotion-jsx-runtime.d.ts` shim.
The previous ZIP already had classic `"jsx": "react"` in `tsconfig.json`, but this
separate shim still re-exported `react/jsx-runtime`. A compiler-host test reproduced
that explicit re-export causing a read of the real React JSX type file even with
classic JSX and `skipLibCheck` enabled. The patched file contains comments only.
It stays in the ZIP to overwrite the old file during an update.

Close Visual Studio and copy the updated widget files over the existing folder.
Delete only the `.vs` cache inside this widget folder, if it exists, then use
**File > Open > Folder** to open this folder directly:

```text
C:\arcgis-experience-builder-1.21\client\your-extensions\widgets\basemap-gallery-custom
```

Do not open the entire `client` folder or keep files from `client\node_modules`,
`client\jimu-core`, or `client\dist` open in the editor while checking this widget.
The handoff explains that these can make Visual Studio analyze a different project.
The widget-level `tsconfig.json` remains self-contained and unchanged.
No dependency install or file-permission change is part of this patch.
See `docs/EDITOR_FIX.md` for the reproduction, limitations, and validation.

### `npm install` fails on Experience Builder 1.21

This is expected. Starting with 1.21, dependencies must be installed with pnpm. Run
`npm i -g pnpm` once, then `pnpm ci` in the `client` folder. See the install steps above.

### Upgrading Experience Builder versions

After moving the widget between Experience Builder versions, clear `client\dist\widgets` of
the old compiled copy before running `npm start`, otherwise the build can see both the new
source and the old compiled widget and report a duplicate.

### The widget shows "No map connected"

The widget is not linked to a map. Open the widget settings and select a map widget.

### Compare says a basemap could not be loaded for comparison

The compare feature loads its own copy of the chosen basemap item from the configured
portal. The browser console names the item ID. Check the same things as for a gallery
load failure. Choosing another basemap, or closing and reopening compare, retries.

### The map cannot be panned or zoomed while compare is on

Fixed in 1.21.2. `view.ui` gives every component `pointer-events: auto`, and the
`<arcgis-swipe>` host covers the whole view. The widget now sets `pointer-events: none`
on the host and injects a small stylesheet into the component's shadow root so only the
divider and handle stay interactive. If it recurs after a Maps SDK upgrade, the divider or
handle class names inside the component have changed; see `SWIPE_POINTER_CSS` in `widget.tsx`.

### The divider is missing after choosing a compare basemap

`<arcgis-swipe>` comes from the shared `arcgis-map-components` bundle and is added to
`view.ui`. Confirm the Experience Builder build loaded that bundle (the console reports
a failed `js.arcgis.com/.../map-components` request otherwise) and that the map widget
is a 2D map. The compare layers still appear at full width if the divider fails.

### Some basemaps show a notice that they could not be loaded

One or more configured item IDs failed to load. Open the browser console for a warning
naming each failed item ID, then check that the item exists, is shared appropriately, and
is a Web Map or Vector Tile Service on the configured portal.

## Feedback

Questions and feedback are welcome on the Esri Community post:
https://community.esri.com/t5/experience-builder-custom-widgets/basemap-gallery-custom-widget/ba-p/1676397

## Developer checks

The widget uses the handoff's self-contained, editor-only TypeScript setup with classic
JSX. The shared `src/exb-editor-shims.d.ts` is copied unchanged from the published
Property Report reference. Widget-specific declarations are separate in
`src/vendor-shims.d.ts` (including `arcgis-map-components`, `CalciteSlider`, and
`esri/core/Collection`) and `src/runtime/esri.d.ts`. The two existing files that use
Emotion's `css` prop have explicit JSX and fragment pragmas to preserve that rendering.

From the widget folder inside the Experience Builder client tree, run:

```powershell
node --test tests/help-content.test.cjs tests/help-ui.test.cjs tests/help-consistency.test.cjs tests/editor-isolation.test.cjs
npx tsc -p .
```

The tests reuse the client's TypeScript installation and Node's built-in test runner.
There are no added Jest or browser-test dependencies. Node 18 or newer is required for
this test runner. `npm test` runs the same tests. `tests/help-consistency.test.cjs` contains
the `WIDGETS` list for checking additional sibling widgets against the supplied guide.

See `docs/HELP_GUIDE.md` for maintenance notes and the remaining live-app checks.
See `CHANGELOG.md` for the update details and `UPDATED_FILES.md` for the file inventory.
