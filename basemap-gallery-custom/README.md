# Basemap Gallery Custom Widget

A custom widget for ArcGIS Experience Builder that extends the out of the box Basemap
Gallery with additional configuration for developers.

## Features

- In-widget Help with a searchable guide, one open section at a time, and a dismissible
  first-run hint. The guide describes the controls and messages currently available.
- Display basemaps as thumbnails or as a list
- Five size settings for the list and thumbnail layouts
- Add basemaps by service URL as well as by portal item: a cached or dynamic ArcGIS map
  service, an image service, a vector tile service, or a WMS or WMTS endpoint. The widget
  reads the service description to pick the layer type and title, and the entry travels
  in the XML export
- Edit any entry in place (title, thumbnail, and for URL entries the address and layer
  type), and pick a thumbnail from an image file as well as a URL
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

Version **1.23.0** is the widget release number, not a change to the Experience Builder
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

1. Download `basemap-gallery-custom.zip` from the latest release and unzip it.

   The zip is the widget only. The Visual Studio type shims in the repo
   (`basemap-gallery-custom/src/exb-editor-shims.d.ts` and
   `basemap-gallery-custom/src/vendor-shims.d.ts`) are left out on purpose: their ambient
   `declare module` blocks are not file-scoped and would rewrite the react, jimu and esri
   types for every other widget in your `your-extensions` folder. The `tests` folder is
   left out for the same reason, since two of its suites read those files.

   If you clone the repository instead of using the zip, delete
   `basemap-gallery-custom/src/exb-editor-shims.d.ts` before building. Nothing else
   depends on it.
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

     Run the `npm i -g pnpm` part from any folder except `client` or `server`. If the `-g`
     is mistyped or dropped there, npm reads it as package names and writes junk entries
     (`@`, `g`, `pnpm`) into that folder's `package.json`, and every later `pnpm ci` fails
     with `ERR_PNPM_OUTDATED_LOCKFILE`. The fix is to delete those three entries from
     `package.json` and run `pnpm install` again.

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

## Basemaps from a service URL

The **Add Basemap from URL** section in the settings takes a REST endpoint instead of a
portal item, the same job as "Add basemap from URL" in the out of the box gallery.

1. Paste the service URL. ArcGIS REST endpoints end in `MapServer`, `ImageServer` or
   `VectorTileServer`; a WMS endpoint carries `service=WMS` or ends in `WMSServer`; a
   WMTS endpoint contains `WMTS`. A pasted `?f=json` or trailing slash is dropped.
2. Leave **Layer type** on Auto-detect. For an ArcGIS REST URL the widget fetches the
   service description (`?f=json`) and picks a tile layer for a cached map service, a map
   image layer for a dynamic one, an imagery tile layer for a cached image service, an
   imagery layer otherwise, or a vector tile layer. WMS and WMTS are recognized from the
   URL. Pick a type yourself when the service cannot be reached from the Builder or the
   URL is not one of those shapes.
3. Title and thumbnail are optional. The title comes from the service description
   (document title, then map name, then the service name in the URL) when left blank.
   URL basemaps have no portal thumbnail, so the card shows a plain placeholder unless
   you give it an image URL.
4. Click Add basemap. The entry appears in Selected Basemaps with a URL badge, its layer
   type and the endpoint, and it can be reordered, starred as the default, favorited and
   compared like any other basemap.

**Thumbnail from a file.** Choose image in either form takes an image file instead of a
URL. The widget resizes it to the card size (300 x 225, cropped like `object-fit: cover`)
and stores a small JPEG copy in the widget settings, so nothing is uploaded anywhere and
the picture travels with the XML export. Keep source files under 10 MB.

**Editing an entry.** The pencil on a Selected Basemaps card opens the title and
thumbnail for changes, and for a URL entry also the service URL and layer type. Changing
the URL reads the service again and gives the entry a new id (the id is a hash of the
URL), so the list position and the default follow it but a user's browser favorite for
that one basemap resets. Portal items get title and thumbnail editing only; what is typed
there wins over the portal item's own title and thumbnail.

How it works: each URL entry gets a stable id (`url-` plus a hash of the endpoint), so
favorites and the default survive an XML round trip and the same service cannot be added
twice. At runtime the widget builds a `Basemap` with one base layer from the matching
Maps SDK layer class and sets `Basemap.id` to that id; live sync recognizes the basemap
through that id because there is no portal item to match on. Compare builds a second,
fresh layer from the URL rather than reusing the gallery's layer object. The XML export
writes `<url>` and `<layerType>` on those entries; import recomputes the id from the URL.

Things that are different from portal items:

- Secured services: the widget asks the service with the browser's identity. A service
  that prompts for a sign-in in the Builder needs the same sign-in in the app.
- CORS and HTTPS: the service must allow the app's origin and be reachable over HTTPS
  from an HTTPS app, the same requirements as for any layer in the map.
- Map Switcher hand-off carries portal item ids only; a URL basemap is not carried
  between apps.
- The portal browser in the settings only lists items. URL entries show up in Selected
  Basemaps once added.

## Notes

- Favorites are stored in the browser (localStorage) per widget, so they are personal to
  each user and each browser. Clearing browser data clears favorites.
- The default basemap is applied once when the map loads. After that the widget never
  overrides a basemap the user has chosen.

## Usage telemetry

This widget records anonymous usage counts and errors so the GIS Division can see which widgets and versions are in use and which errors users hit. It records the app id and title, widget name and version, the action name, a truncated error message, the site host name and browser family. It never records usernames, coordinates, addresses, attribute values or URLs with query strings. Where the data goes: on page load the widget asks the app's portal for a public item tagged `exb-beacon-sink` and posts to that table. If your portal has no such item, nothing is sent anywhere. To turn it off for an app, set `"telemetry": false` in the widget's config, or users can enable Do Not Track in their browser. The shared module is `src/shared/beacon.ts`.

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

### A basemap added by URL does not appear, or the card is there but the map is blank

The service description could be read in the Builder but the layer fails in the app, or
the other way round. Open the browser console and look for the request to the service
URL. A `401` or `403` means the service needs a sign-in the app does not have. A CORS
error means the server does not allow the app's origin. A `404` on `/tile/` requests
with a map image service, or a blank layer from a tile layer, means the layer type is
wrong for that service: remove the entry and add it again with the correct type.

### Some basemaps show a notice that they could not be loaded

One or more configured item IDs failed to load. Open the browser console for a warning
naming each failed item ID, then check that the item exists, is shared appropriately, and
is a Web Map or Vector Tile Service on the configured portal.

## Feedback

Questions and feedback are welcome on the Esri Community post:
https://community.esri.com/t5/experience-builder-custom-widgets/basemap-gallery-custom-widget/ba-p/1676397

## Developer checks

The widget uses the handoff's self-contained, editor-only TypeScript setup with
`jsx: react-jsx` through `@emotion/react` (the tsconfig header explains why that must
not change). The shared `src/exb-editor-shims.d.ts` is copied unchanged from the published
Property Report reference. Widget-specific declarations are separate in
`src/vendor-shims.d.ts` (including `arcgis-map-components`, `CalciteSlider`, and
`esri/core/Collection`) and `src/runtime/esri.d.ts`. The two existing files that use
Emotion's `css` prop have explicit JSX and fragment pragmas to preserve that rendering.

From the widget folder inside the Experience Builder client tree, run:

```powershell
node --test tests/help-content.test.cjs tests/help-ui.test.cjs tests/help-consistency.test.cjs tests/editor-isolation.test.cjs tests/basemap-url.test.cjs
npx tsc -p .
```

The `tests` folder and the two editor shim files are in the GitHub repository but not in
the release zip, so clone the repository if you want to run them. The tests reuse the
client's TypeScript installation and Node's built-in test runner. There are no added Jest
or browser-test dependencies. Node 18 or newer is required for this test runner.
`npm test` runs the same tests. `tests/help-consistency.test.cjs` contains
the `WIDGETS` list for checking additional sibling widgets against the supplied guide.

See `docs/HELP_GUIDE.md` for maintenance notes and the remaining live-app checks.
See `CHANGELOG.md` for the update details and `UPDATED_FILES.md` for the file inventory.

## Localization verification

The October 2026 i18n pass connects local UI helpers, messages and metadata to the app locale and uses the app locale for date/number formatting. Existing units, currencies and configured format options are preserved. Translation files use Esri wording, shared memory and English fallbacks; machine translations still need language review. Catalog coverage is separate from UI coverage. Changes were checked with the widget’s Experience Builder webpack build and compared against its existing TypeScript diagnostics. Test runtime, settings, accessibility text and locale switching in your target languages.
