// Editor-only additions for this widget. The shared master stays unchanged.
// Classic JSX avoids resolving Emotion through pnpm junctions (handoff Section 12.3).
declare namespace JSX {
  type Element = any
  interface IntrinsicElements { [k: string]: any }
  interface ElementClass { render (): any }
  interface ElementAttributesProperty { props: {} }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { [k: string]: any }
}

declare module 'calcite-components' {
  export const CalciteIcon: any
  export const CalciteSlider: any
}

// Experience Builder's shared ArcGIS Maps SDK components bundle (registers <arcgis-swipe>).
declare module 'arcgis-map-components'

declare module 'esri/core/Collection' {
  export default class Collection<T = any> {
    constructor (items?: T[])
    [key: string]: any
    toArray (): T[]
    removeAll (): void
  }
}

declare module 'esri/Basemap' {
  export default class Basemap {
    constructor (properties?: any)
    [key: string]: any
    load (): Promise<Basemap>
    loadAll (): Promise<Basemap>
  }
}

declare module 'esri/core/reactiveUtils' {
  export function watch (getValue: () => any, callback: (value: any, ...args: any[]) => void, options?: any): { remove (): void }
}
