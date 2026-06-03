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
- Set a default basemap for application load
- WCAG compliant

## Requirements

- ArcGIS Experience Builder Developer Edition 1.19 or 1.20 (both run React 19).
- Experience Builder 1.18 and earlier run React 18 and are not supported.

## Install

1. Download the latest release and unzip it.
2. Copy the `basemap-gallery-custom` folder into your Experience Builder install so the
   manifest sits directly at
   `client\your-extensions\widgets\basemap-gallery-custom\manifest.json`. Do not nest the
   folder a second level deep.
3. From the `client` folder run `npm install`, then `npm start`.
4. Add the widget to an experience from the Insert widget panel.

The widget folder ships with its own README that includes install placement details and a
troubleshooting section for the `is duplicated` build error. See
[`basemap-gallery-custom/README.md`](basemap-gallery-custom/README.md).

## License

Apache-2.0. Copyright City of Grand Junction, CO.
