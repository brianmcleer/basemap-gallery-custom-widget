# Basemap Gallery Custom Widget

A custom widget for ArcGIS Experience Builder that extends the out of the box Basemap
Gallery with additional configuration for developers.

Esri Community post:
https://community.esri.com/t5/experience-builder-custom-widgets/basemap-gallery-custom-widget/ba-p/1676397

## Features

- Display basemaps as thumbnails or as a list
- Five size settings for the list and thumbnail layouts
- Import and export XML files to transfer widget settings across applications
- Reorder the basemaps in the list
- Set a default basemap that is applied to the map on application load
- Favorites: star a basemap to pin it to the top of the gallery, persisted per browser,
  with an F key shortcut for keyboard users
- Search box to filter basemaps by name, shown automatically for galleries with more
  than 8 basemaps
- Live sync: the active indicator stays correct even when the basemap is changed by
  another widget, a bookmark, or the out of the box gallery
- Fast loading: basemaps load in parallel with skeleton placeholders, and one bad item
  ID no longer blocks the rest
- WCAG compliant: full keyboard navigation with row aware arrow keys in grid view,
  screen reader announcements, and reduced motion support

## Requirements

- ArcGIS Experience Builder Developer Edition 1.19, 1.20, or 1.21 (all run React 19).
- Experience Builder 1.18 and earlier run React 18 and are not supported.

## Install

1. Download `basemap-gallery-custom.zip` from the latest release and unzip it.

   The zip is the widget only. The Visual Studio type shims in this repo
   (`basemap-gallery-custom/src/exb-editor-shims.d.ts` and
   `basemap-gallery-custom/src/vendor-shims.d.ts`) are left out on purpose: their ambient
   `declare module` blocks are not file-scoped and would rewrite the react, jimu and esri
   types for every other widget in your `your-extensions` folder. The `tests` folder is
   left out for the same reason, since two of its suites read those files.

   If you clone this repository instead of using the zip, delete
   `basemap-gallery-custom/src/exb-editor-shims.d.ts` before building. Nothing else
   depends on it.
2. Copy the `basemap-gallery-custom` folder into your Experience Builder install so the
   manifest sits directly at
   `client\your-extensions\widgets\basemap-gallery-custom\manifest.json`. Do not nest the
   folder a second level deep.
3. Install dependencies from the `client` folder, then run `npm start`. On Experience
   Builder 1.19 and 1.20 install with `npm install`. On 1.21 and newer install with pnpm
   instead (`npm i -g pnpm` once, then `pnpm ci`), because `npm install` errors on 1.21.
4. Add the widget to an experience from the Insert widget panel.

The widget folder ships with its own README that includes a keyboard reference, install
placement details, and a troubleshooting section for the `is duplicated` build error. See
[`basemap-gallery-custom/README.md`](basemap-gallery-custom/README.md).

## License

Apache-2.0. Copyright City of Grand Junction, CO.
