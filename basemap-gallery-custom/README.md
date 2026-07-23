# Basemap Gallery Custom Widget

A custom widget for ArcGIS Experience Builder that extends the out of the box Basemap
Gallery with additional configuration for developers.

## Features

- Display basemaps as thumbnails or as a list
- Five size settings for the list and thumbnail layouts
- Import and export XML files to transfer widget settings across applications
- Reorder the basemaps in the list
- Set a default basemap that is applied to the map on application load
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

## Keyboard reference

- Tab: move focus into the gallery
- Arrow keys: move between basemaps (up and down move by row in grid view)
- Enter or Space: apply the focused basemap to the map
- F: add or remove the focused basemap from favorites
- Home / End: jump to the first or last basemap

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

### `npm install` fails on Experience Builder 1.21

This is expected. Starting with 1.21, dependencies must be installed with pnpm. Run
`npm i -g pnpm` once, then `pnpm ci` in the `client` folder. See the install steps above.

### Upgrading Experience Builder versions

After moving the widget between Experience Builder versions, clear `client\dist\widgets` of
the old compiled copy before running `npm start`, otherwise the build can see both the new
source and the old compiled widget and report a duplicate.

### The widget shows "No map connected"

The widget is not linked to a map. Open the widget settings and select a map widget.

### Some basemaps show a notice that they could not be loaded

One or more configured item IDs failed to load. Open the browser console for a warning
naming each failed item ID, then check that the item exists, is shared appropriately, and
is a Web Map or Vector Tile Service on the configured portal.

## Feedback

Questions and feedback are welcome on the Esri Community post:
https://community.esri.com/t5/experience-builder-custom-widgets/basemap-gallery-custom-widget/ba-p/1676397
