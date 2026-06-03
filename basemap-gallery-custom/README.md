# Basemap Gallery Custom Widget

A custom widget for ArcGIS Experience Builder that extends the out of the box Basemap
Gallery with additional configuration for developers.

## Features

- Display basemaps as thumbnails or as a list
- Five size settings for the list and thumbnail layouts
- Import and export XML files to transfer widget settings across applications
- Reorder the basemaps in the list
- Set a default basemap for application load
- WCAG compliant

## Requirements

- ArcGIS Experience Builder Developer Edition 1.19 or 1.20 (both run React 19).
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
3. From a terminal in the `client` folder, run `npm install`. Experience Builder installs
   any widget dependencies automatically. This widget has no third party dependencies, so
   nothing extra is pulled in.
4. Start the client with `npm start`. Watch the Entrypoint list as the build runs and
   confirm that `basemap-gallery-custom` appears.
5. Add the widget to an experience from the Insert widget panel.

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

### Upgrading Experience Builder versions

After moving the widget between Experience Builder versions, clear `client\dist\widgets` of
the old compiled copy before running `npm start`, otherwise the build can see both the new
source and the old compiled widget and report a duplicate.

## Feedback

Questions and feedback are welcome on the Esri Community post:
https://community.esri.com/t5/experience-builder-custom-widgets/basemap-gallery-custom-widget/ba-p/1676397
