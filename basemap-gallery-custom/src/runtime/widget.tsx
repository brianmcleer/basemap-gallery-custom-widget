/** @jsx jsx */
/** @jsxFrag React.Fragment */
import { React, jsx, css } from 'jimu-core'
import { type AllWidgetProps } from 'jimu-core'
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import { Button, Loading, Tooltip, TextInput } from 'jimu-ui'
import { CalciteIcon, CalciteSlider } from 'calcite-components'
// Registers the ArcGIS Maps SDK map components (arcgis-swipe) through the
// Experience Builder shared bundle. No copy of the library is bundled here.
import 'arcgis-map-components'
import HelpPopup from './components/HelpPopup'
import FirstRunHint from './components/FirstRunHint'
import { buildHelpSections, type HelpFeatures } from './helpSections'
import { dismissHelpHint, isHelpHintDismissed } from './helpHint'
import defaultMessages from './translations/default'
import { beacon } from '../shared/beacon'
import type { BeaconHandle } from '../shared/beacon'
import Basemap from 'esri/Basemap'
import Portal from 'esri/portal/Portal'
import Collection from 'esri/core/Collection'
import * as reactiveUtils from 'esri/core/reactiveUtils'

const { useEffect, useState, useRef, useCallback, useMemo } = React

interface BasemapItem {
    id: string
    title: string
    thumbnailUrl?: string
}

interface LoadedBasemap {
    id: string
    title: string
    thumbnailUrl: string
    basemap: Basemap
}

type SizeOption = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type DisplayMode = 'grid' | 'list'

interface Config {
    portalUrl?: string
    basemaps?: BasemapItem[]
    defaultBasemapId?: string
    size?: SizeOption
    displayMode?: DisplayMode
    /** Show the Compare control. Undefined means on, so existing configs keep working. */
    enableCompare?: boolean
}

// Everything the compare feature has placed on the map, so it can be removed cleanly.
interface CompareOverlay {
    id: string
    layers: any[]
    swipe: any
    onInput: () => void
}

// Number of basemaps at which the search filter appears
const SEARCH_THRESHOLD = 8

// Starting divider position (percent of the view showing the compare basemap)
const COMPARE_DEFAULT_POSITION = 50

// view.ui gives every component `pointer-events: auto`. The swipe host covers the whole
// view, so that setting swallows pan and zoom. Let events through the host and keep only
// the divider and its handle interactive.
const SWIPE_POINTER_CSS = ':host{pointer-events:none!important}' +
    '.esri-swipe__container{pointer-events:none!important}' +
    '.esri-swipe__divider,.esri-swipe__handle,.esri-swipe__handle-inner{pointer-events:auto!important}'

function letMapEventsThroughSwipe (swipe: any): void {
    try {
        swipe.style.pointerEvents = 'none'
        swipe.style.position = 'absolute'
        swipe.style.inset = '0'
        const root = swipe.shadowRoot
        if (!root) return
        if (typeof CSSStyleSheet !== 'undefined' && Array.isArray(root.adoptedStyleSheets) && !swipe.__bgcPointerSheet) {
            const sheet = new CSSStyleSheet()
            sheet.replaceSync(SWIPE_POINTER_CSS)
            root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
            swipe.__bgcPointerSheet = true
        } else if (!swipe.__bgcPointerSheet) {
            const style = document.createElement('style')
            style.textContent = SWIPE_POINTER_CSS
            root.appendChild(style)
            swipe.__bgcPointerSheet = true
        }
    } catch (err) {
        console.warn('Could not adjust swipe pointer events:', err)
    }
}

// Size configurations for grid mode
const SIZE_CONFIG = {
    xs: {
        minWidth: 70,
        gap: 6,
        padding: 6,
        fontSize: 10,
        titlePadding: '4px 6px',
        indicatorSize: 18,
        indicatorFontSize: 10,
        borderWidth: 2
    },
    sm: {
        minWidth: 95,
        gap: 8,
        padding: 8,
        fontSize: 11,
        titlePadding: '5px 7px',
        indicatorSize: 20,
        indicatorFontSize: 11,
        borderWidth: 2
    },
    md: {
        minWidth: 120,
        gap: 12,
        padding: 12,
        fontSize: 12,
        titlePadding: '6px 8px',
        indicatorSize: 24,
        indicatorFontSize: 14,
        borderWidth: 3
    },
    lg: {
        minWidth: 160,
        gap: 14,
        padding: 14,
        fontSize: 14,
        titlePadding: '8px 10px',
        indicatorSize: 28,
        indicatorFontSize: 16,
        borderWidth: 3
    },
    xl: {
        minWidth: 200,
        gap: 16,
        padding: 16,
        fontSize: 16,
        titlePadding: '10px 12px',
        indicatorSize: 32,
        indicatorFontSize: 18,
        borderWidth: 4
    }
}

// Size configurations for list mode
const LIST_SIZE_CONFIG = {
    xs: {
        thumbnailSize: 32,
        gap: 4,
        padding: 6,
        fontSize: 11,
        itemPadding: '6px 8px',
        indicatorSize: 16,
        indicatorFontSize: 10,
        borderWidth: 2
    },
    sm: {
        thumbnailSize: 40,
        gap: 6,
        padding: 8,
        fontSize: 12,
        itemPadding: '8px 10px',
        indicatorSize: 18,
        indicatorFontSize: 11,
        borderWidth: 2
    },
    md: {
        thumbnailSize: 48,
        gap: 8,
        padding: 10,
        fontSize: 13,
        itemPadding: '10px 12px',
        indicatorSize: 20,
        indicatorFontSize: 12,
        borderWidth: 2
    },
    lg: {
        thumbnailSize: 60,
        gap: 10,
        padding: 12,
        fontSize: 14,
        itemPadding: '12px 14px',
        indicatorSize: 24,
        indicatorFontSize: 14,
        borderWidth: 3
    },
    xl: {
        thumbnailSize: 72,
        gap: 12,
        padding: 14,
        fontSize: 16,
        itemPadding: '14px 16px',
        indicatorSize: 28,
        indicatorFontSize: 16,
        borderWidth: 3
    }
}

type WidgetProps = AllWidgetProps<Config> & { id: string; useMapWidgetIds?: string[] }

const Widget = (props: WidgetProps) => {
    const t = useCallback((id: string, values?: Record<string, string>): string => {
        const message = defaultMessages[id as keyof typeof defaultMessages] || id
        if (props.intl) {
            return props.intl.formatMessage({ id, defaultMessage: message }, values)
        }
        return message.replace(/\{(\w+)\}/g, (match, key: string) => values?.[key] ?? match)
    }, [props.intl])
    const [helpOpen, setHelpOpen] = useState(false)
    const [showFirstRunHint, setShowFirstRunHint] = useState(() => !isHelpHintDismissed(props.id))
    const beaconRef = useRef<BeaconHandle | null>(null)
    useEffect(() => { beaconRef.current = beacon.init(props) }, [])

    useEffect(() => {
        setShowFirstRunHint(!isHelpHintDismissed(props.id))
    }, [props.id])

    const onDismissHint = useCallback(() => {
        setShowFirstRunHint(false)
        dismissHelpHint(props.id)
    }, [props.id])

    const onOpenHelp = useCallback(() => {
        setHelpOpen(true)
        onDismissHint()
    }, [onDismissHint])
    const onHelp = onOpenHelp

    const [jimuMapView, setJimuMapView] = useState<JimuMapView>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [loadedBasemaps, setLoadedBasemaps] = useState<LoadedBasemap[]>([])
    const [failedCount, setFailedCount] = useState(0)
    const [activeBasemapId, setActiveBasemapId] = useState<string>(null)
    const [error, setError] = useState<string>(null)
    const [focusedIndex, setFocusedIndex] = useState<number>(-1)
    const [searchText, setSearchText] = useState('')
    const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({})
    const [favorites, setFavorites] = useState<string[]>(() => {
        try {
            const raw = window.localStorage.getItem(`bgc-favorites-${props.id}`)
            return raw ? JSON.parse(raw) : []
        } catch {
            return []
        }
    })
    const galleryRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLDivElement | null)[]>([])
    const statusRef = useRef<HTMLDivElement>(null)
    // Cache in-flight/completed loadAll() calls so each basemap's underlying
    // TileLayers are warmed only once. This loads layer metadata up front;
    // actual map tiles still come from the ArcGIS Server cache on demand.
    const preloadPromisesRef = useRef<Record<string, Promise<Basemap> | undefined>>({})
    // Tracks which map views have already had the default basemap applied,
    // so the default applies once on load and never fights the user afterward
    const defaultAppliedRef = useRef<Record<string, boolean>>({})

    // Compare: a second basemap is placed on the map as ordinary layers and an
    // arcgis-swipe divider clips it. The slider below the header drives the divider.
    // The compare idea comes from Nicholas Cramer's modified out of the box Basemap
    // Gallery widget, which blends two basemaps by layer opacity with a range slider.
    // This version keeps his enter/exit flow and slider bar but shows the two basemaps
    // side by side with a divider instead of a crossfade.
    const [compareMode, setCompareMode] = useState(false)
    const [compareBasemapId, setCompareBasemapId] = useState<string>(null)
    const [comparePosition, setComparePositionState] = useState(COMPARE_DEFAULT_POSITION)
    // Mirror of comparePosition for callbacks that must not go stale while dragging
    const comparePositionRef = useRef(COMPARE_DEFAULT_POSITION)
    const setComparePosition = useCallback((value: number) => {
        comparePositionRef.current = value
        setComparePositionState(value)
    }, [])
    const [compareLoading, setCompareLoading] = useState(false)
    const [compareError, setCompareError] = useState<string>(null)
    const compareRef = useRef<CompareOverlay>(null)
    // Ignore a slow compare load that finishes after the user picked another basemap
    const compareRequestRef = useRef(0)

    const size = props.config?.size || 'md'
    const displayMode = props.config?.displayMode || 'grid'
    const sizeConfig = SIZE_CONFIG[size]
    const listSizeConfig = LIST_SIZE_CONFIG[size]
    const hasMapWidget = props.useMapWidgetIds?.length === 1
    const enableCompare = props.config?.enableCompare !== false

    // WCAG 4.1.3 - Announce status changes to screen readers
    const announceStatus = useCallback((message: string) => {
        if (statusRef.current) {
            statusRef.current.textContent = message
        }
    }, [])

    // Warm the selected basemap's underlying layers. Basemap.load() only loads
    // the basemap item itself; loadAll() also loads its base/reference layers.
    // For ArcGISTiledMapServiceLayer items this keeps them as TileLayers and
    // continues using /MapServer/tile/... cache requests.
    const preloadBasemap = useCallback((item: LoadedBasemap): Promise<Basemap> => {
        const existing = preloadPromisesRef.current[item.id]
        if (existing) return existing

        const promise = item.basemap.loadAll().catch((err) => {
            // Allow a later hover/click to retry if a temporary service error occurs.
            delete preloadPromisesRef.current[item.id]
            console.warn(`Failed to preload basemap layers ${item.id}:`, err)
            throw err
        })

        preloadPromisesRef.current[item.id] = promise
        return promise
    }, [])

    // Load basemaps when the map view or config changes
    useEffect(() => {
        if (!jimuMapView?.view) return

        let destroyed = false

        const loadBasemaps = async () => {
            setIsLoading(true)
            setError(null)
            setFailedCount(0)
            announceStatus('Loading basemaps...')

            const configBasemaps = props.config?.basemaps as BasemapItem[] | undefined

            if (!configBasemaps || configBasemaps.length === 0) {
                setLoadedBasemaps([])
                setIsLoading(false)
                announceStatus('No basemaps configured')
                return
            }

            try {
                await jimuMapView.view.when()

                const portalUrl = props.config?.portalUrl || 'https://www.arcgis.com'
                const portal = new Portal({ url: portalUrl })

                // jimu config arrays are seamless-immutable. Mapping them
                // directly returns an immutable result that freezes the new
                // Basemap instances and breaks load(), so convert to a plain
                // array first.
                const itemList: BasemapItem[] = typeof (configBasemaps as any).asMutable === 'function'
                    ? (configBasemaps as any).asMutable()
                    : Array.from(configBasemaps as any)

                // Load all basemaps in parallel. allSettled keeps one bad item ID
                // from sinking the rest, and the results array preserves the
                // configured order.
                const basemapObjects = itemList.map(item =>
                    new Basemap({
                        portalItem: {
                            id: item.id,
                            portal: portal
                        }
                    })
                )

                const results = await Promise.allSettled(
                    basemapObjects.map(bm => bm.load())
                )

                if (destroyed) return

                const loaded: LoadedBasemap[] = []
                let failed = 0

                results.forEach((result, i) => {
                    const item = itemList[i]
                    if (result.status === 'fulfilled') {
                        const basemap = basemapObjects[i]
                        loaded.push({
                            id: item.id,
                            title: basemap.title || item.title,
                            thumbnailUrl: basemap.thumbnailUrl || item.thumbnailUrl || '',
                            basemap: basemap
                        })
                    } else {
                        failed++
                        console.warn(`Failed to load basemap ${item.id}:`, result.reason)
                    }
                })

                setLoadedBasemaps(loaded)
                setFailedCount(failed)

                // Warm the underlying TileLayers in the background so the first
                // switch to a historical airphoto does not also pay the layer-load
                // cost. Limit concurrency to avoid hammering the production server.
                void (async () => {
                    const queue = [...loaded]
                    const workerCount = Math.min(4, queue.length)
                    const workers = Array.from({ length: workerCount }, async () => {
                        while (!destroyed && queue.length > 0) {
                            const item = queue.shift()
                            if (!item) break
                            try {
                                await preloadBasemap(item)
                            } catch {
                                // Individual failures are logged by preloadBasemap;
                                // keep warming the rest of the gallery.
                            }
                        }
                    })
                    await Promise.all(workers)
                })()

                // Determine what should be active, in priority order:
                // 1. Apply the configured default basemap once per map view.
                //    This is the "set default basemap for application load" feature.
                // 2. Otherwise reflect whatever basemap the map is already showing.
                const view = jimuMapView.view
                const viewKey = jimuMapView.id
                const defaultId = props.config?.defaultBasemapId
                const defaultBasemap = defaultId
                    ? loaded.find(b => b.id === defaultId)
                    : undefined
                const currentBasemapId = view.map?.basemap?.portalItem?.id

                if (defaultBasemap && !defaultAppliedRef.current[viewKey]) {
                    defaultAppliedRef.current[viewKey] = true
                    if (currentBasemapId !== defaultBasemap.id) {
                        view.map.basemap = defaultBasemap.basemap
                    }
                    setActiveBasemapId(defaultBasemap.id)
                } else if (currentBasemapId && loaded.some(b => b.id === currentBasemapId)) {
                    setActiveBasemapId(currentBasemapId)
                }

                setIsLoading(false)
                const failedNote = failed > 0 ? ` ${failed} failed to load.` : ''
                announceStatus(`${loaded.length} basemap${loaded.length !== 1 ? 's' : ''} loaded.${failedNote} Use arrow keys to navigate, Enter or Space to select.`)
            } catch (err) {
                if (!destroyed) {
                    const errorMsg = `Failed to load basemaps: ${err.message}`
                    setError(errorMsg)
                    setIsLoading(false)
                    announceStatus(errorMsg)
                }
            }
        }

        loadBasemaps()

        return () => {
            destroyed = true
        }
    }, [jimuMapView, props.config?.portalUrl, props.config?.basemaps, props.config?.defaultBasemapId, announceStatus, preloadBasemap])

    // Live sync: keep the active indicator correct when the basemap is changed
    // from anywhere else (another widget, a bookmark, the OOTB gallery)
    useEffect(() => {
        const view = jimuMapView?.view
        if (!view?.map) return

        const handle = reactiveUtils.watch(
            () => view.map.basemap,
            (basemap) => {
                const id = basemap?.portalItem?.id
                setActiveBasemapId(id || null)
            }
        )

        return () => {
            handle.remove()
        }
    }, [jimuMapView])

    // Remove the compare layers and the swipe divider from whichever view holds them.
    // Safe to call when nothing is active. Does not change compare mode itself.
    const clearCompareOverlay = useCallback(() => {
        const overlay = compareRef.current
        compareRef.current = null
        compareRequestRef.current++
        if (!overlay) return
        const view = jimuMapView?.view
        try {
            if (overlay.swipe) {
                overlay.swipe.removeEventListener('arcgisSwipeInput', overlay.onInput)
                overlay.swipe.removeEventListener('arcgisSwipeChange', overlay.onInput)
                view?.ui?.remove?.(overlay.swipe)
                if (typeof overlay.swipe.destroy === 'function') {
                    void Promise.resolve(overlay.swipe.destroy()).catch(() => undefined)
                }
                overlay.swipe.remove?.()
            }
            if (view?.map && overlay.layers.length > 0) {
                view.map.removeMany(overlay.layers)
            }
            overlay.layers.forEach(layer => { layer.destroy?.() })
        } catch (err) {
            console.warn('Failed to remove compare layers:', err)
        }
    }, [jimuMapView])

    // Put the chosen basemap on the left side of the divider. The map's own basemap
    // (the checked one in the gallery) stays on the right side.
    const startCompare = useCallback(async (item: LoadedBasemap) => {
        beaconRef.current?.action('compare')
        const view = jimuMapView?.view
        if (!view?.map) return

        clearCompareOverlay()
        const requestId = compareRequestRef.current
        setCompareBasemapId(item.id)
        setCompareLoading(true)
        setCompareError(null)
        announceStatus(`Loading ${item.title} for comparison`)
        let addedLayers: any[] = []

        try {
            // A separate Basemap object so the gallery's own layer objects stay untouched.
            const portalUrl = props.config?.portalUrl || 'https://www.arcgis.com'
            const source = new Basemap({
                portalItem: { id: item.id, portal: new Portal({ url: portalUrl }) }
            })
            await source.loadAll()
            if (requestId !== compareRequestRef.current) return

            // The shared map-components bundle registers arcgis-swipe. Wait for it
            // before touching the map so a missing bundle leaves the map unchanged.
            if (typeof customElements !== 'undefined' && customElements.whenDefined) {
                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(() => { reject(new Error('arcgis-swipe is not registered')) }, 15000)
                    customElements.whenDefined('arcgis-swipe').then(
                        () => { clearTimeout(timer); resolve() },
                        (err) => { clearTimeout(timer); reject(err) }
                    )
                })
            }
            if (requestId !== compareRequestRef.current) return

            // Swipe only clips layers that belong to the map, so move the basemap's
            // layers out of the Basemap and into the map below the operational layers.
            const layers: any[] = [
                ...source.baseLayers.toArray(),
                ...source.referenceLayers.toArray()
            ]
            source.baseLayers.removeAll()
            source.referenceLayers.removeAll()
            view.map.addMany(layers, 0)
            addedLayers = layers

            const swipe: any = document.createElement('arcgis-swipe')
            swipe.view = view
            swipe.direction = 'horizontal'
            swipe.position = comparePositionRef.current
            // Maps SDK 5.x names the sides startLayers/endLayers; 4.x builds used leadingLayers
            const startLayers = new Collection(layers)
            if ('startLayers' in swipe || !('leadingLayers' in swipe)) {
                swipe.startLayers = startLayers
            } else {
                swipe.leadingLayers = startLayers
            }
            const onInput = () => {
                const value = Number(swipe.position)
                if (Number.isFinite(value)) {
                    setComparePosition(Math.round(value))
                }
            }
            swipe.addEventListener('arcgisSwipeInput', onInput)
            swipe.addEventListener('arcgisSwipeChange', onInput)
            // The shadow root may not exist until the component renders, so apply now and again on ready
            letMapEventsThroughSwipe(swipe)
            swipe.addEventListener('arcgisReady', () => { letMapEventsThroughSwipe(swipe) }, { once: true })
            view.ui.add(swipe, 'manual')
            letMapEventsThroughSwipe(swipe)

            compareRef.current = { id: item.id, layers, swipe, onInput }
            setCompareLoading(false)
            announceStatus(`Comparing ${item.title} on the left with the current basemap on the right. Drag the divider or use the slider.`)
        } catch (err) {
            beaconRef.current?.error(err, 'compare')
            // Nothing half-built may stay on the map
            if (addedLayers.length > 0) {
                try {
                    view.map.removeMany(addedLayers)
                    addedLayers.forEach(layer => { layer.destroy?.() })
                } catch {
                    // The view may already be gone
                }
            }
            if (requestId !== compareRequestRef.current) return
            console.warn(`Failed to compare basemap ${item.id}:`, err)
            setCompareLoading(false)
            setCompareBasemapId(null)
            setCompareError(`${item.title} could not be loaded for comparison.`)
            announceStatus(`${item.title} could not be loaded for comparison`)
        }
    }, [jimuMapView, props.config?.portalUrl, clearCompareOverlay, announceStatus, setComparePosition])

    const stopCompare = useCallback(() => {
        clearCompareOverlay()
        setCompareMode(false)
        setCompareBasemapId(null)
        setCompareLoading(false)
        setCompareError(null)
        announceStatus('Compare closed. The map shows the current basemap only.')
    }, [clearCompareOverlay, announceStatus])

    const toggleCompareMode = useCallback(() => {
        if (compareMode) {
            stopCompare()
        } else {
            setCompareMode(true)
            setCompareError(null)
            announceStatus('Compare on. Choose a basemap to show on the left side of the map.')
        }
    }, [compareMode, stopCompare, announceStatus])

    const handleCompareSlider = useCallback((e: any) => {
        const value = Number(e?.target?.value)
        if (!Number.isFinite(value)) return
        const clamped = Math.min(100, Math.max(0, Math.round(value)))
        setComparePosition(clamped)
        const swipe = compareRef.current?.swipe
        if (swipe) {
            swipe.position = clamped
        }
    }, [setComparePosition])

    // Compare layers must not outlive the map view they were added to
    useEffect(() => {
        return () => {
            clearCompareOverlay()
        }
    }, [clearCompareOverlay])

    // Leaving compare mode, or a config change that hides it, drops the overlay
    useEffect(() => {
        if (!enableCompare && (compareMode || compareRef.current)) {
            clearCompareOverlay()
            setCompareMode(false)
            setCompareBasemapId(null)
            setCompareLoading(false)
            setCompareError(null)
        }
    }, [enableCompare, compareMode, clearCompareOverlay])

    // If a config change removes the compared basemap from the gallery, take it off the map too
    useEffect(() => {
        if (!compareBasemapId || isLoading) return
        if (!loadedBasemaps.some(b => b.id === compareBasemapId)) {
            clearCompareOverlay()
            setCompareBasemapId(null)
            setCompareLoading(false)
        }
    }, [loadedBasemaps, compareBasemapId, isLoading, clearCompareOverlay])

    const handleBasemapClick = useCallback((item: LoadedBasemap, index: number) => {
        if (!jimuMapView?.view?.map) return
        setFocusedIndex(index)

        if (compareMode) {
            if (item.id === activeBasemapId) {
                announceStatus(`${item.title} is already the current basemap. Choose a different basemap to compare.`)
                return
            }
            if (item.id === compareRef.current?.id || item.id === compareBasemapId) {
                announceStatus(`${item.title} is already being compared`)
                return
            }
            void startCompare(item)
            return
        }

        // Prioritize this basemap if the background warmer has not reached it yet.
        // Do not await it: applying immediately lets the MapView use the cache now.
        beaconRef.current?.action('apply')
        void preloadBasemap(item).catch(() => undefined)
        jimuMapView.view.map.basemap = item.basemap
        setActiveBasemapId(item.id)
        // WCAG 4.1.3 - Announce selection to screen readers
        announceStatus(`${item.title} basemap applied to map`)
    }, [jimuMapView, announceStatus, preloadBasemap, compareMode, activeBasemapId, compareBasemapId, startCompare])

    // Compare against a focused basemap from the keyboard (C key), entering compare mode if needed
    const handleCompareKey = useCallback((item: LoadedBasemap, index: number) => {
        if (!enableCompare || !jimuMapView?.view?.map) return
        setFocusedIndex(index)
        if (item.id === activeBasemapId) {
            announceStatus(`${item.title} is already the current basemap. Choose a different basemap to compare.`)
            return
        }
        if (item.id === compareRef.current?.id || item.id === compareBasemapId) {
            announceStatus(`${item.title} is already being compared`)
            return
        }
        setCompareMode(true)
        setCompareError(null)
        void startCompare(item)
    }, [enableCompare, jimuMapView, activeBasemapId, compareBasemapId, startCompare, announceStatus])

    const toggleFavorite = useCallback((id: string, title: string) => {
        beaconRef.current?.action('favorite')
        setFavorites(prev => {
            const wasFav = prev.includes(id)
            const next = wasFav ? prev.filter(f => f !== id) : [...prev, id]
            try {
                window.localStorage.setItem(`bgc-favorites-${props.id}`, JSON.stringify(next))
            } catch {
                // Storage unavailable (private mode); favorites just do not persist
            }
            announceStatus(wasFav ? `${title} removed from favorites` : `${title} added to favorites and pinned to top`)
            return next
        })
    }, [props.id, announceStatus])

    // Search filter. The filtered list drives both rendering and keyboard nav
    const visibleBasemaps = useMemo(() => {
        const needle = searchText.trim().toLowerCase()
        const filtered = needle
            ? loadedBasemaps.filter(b => b.title.toLowerCase().includes(needle))
            : loadedBasemaps
        if (favorites.length === 0) return filtered
        const favs = filtered.filter(b => favorites.includes(b.id))
        const rest = filtered.filter(b => !favorites.includes(b.id))
        return [...favs, ...rest]
    }, [loadedBasemaps, searchText, favorites])

    const showSearch = loadedBasemaps.length > SEARCH_THRESHOLD

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setSearchText(value)
        setFocusedIndex(-1)
    }, [])

    // Announce filter results when searching
    useEffect(() => {
        if (!showSearch) return
        if (searchText.trim()) {
            announceStatus(`${visibleBasemaps.length} basemap${visibleBasemaps.length !== 1 ? 's' : ''} match your search`)
        }
    }, [visibleBasemaps.length, searchText, showSearch, announceStatus])

    // Column count for grid-aware arrow key navigation
    const getColumnCount = useCallback((): number => {
        if (displayMode !== 'grid' || !galleryRef.current) return 1
        const styleDecl = window.getComputedStyle(galleryRef.current)
        const columns = styleDecl.gridTemplateColumns.split(' ').filter(Boolean).length
        return Math.max(1, columns)
    }, [displayMode])

    // WCAG 2.1.1 - Keyboard navigation handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent, item: LoadedBasemap, index: number) => {
        const itemCount = visibleBasemaps.length
        if (itemCount === 0) return
        // Leave browser shortcuts (Ctrl+F, Ctrl+C, and so on) alone
        if (e.ctrlKey || e.metaKey || e.altKey) return
        let newIndex = index

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault()
                handleBasemapClick(item, index)
                break
            case 'ArrowRight':
                e.preventDefault()
                newIndex = (index + 1) % itemCount
                break
            case 'ArrowLeft':
                e.preventDefault()
                newIndex = (index - 1 + itemCount) % itemCount
                break
            case 'ArrowDown': {
                e.preventDefault()
                // In grid mode, down moves one row; in list mode, one item
                const step = displayMode === 'grid' ? getColumnCount() : 1
                newIndex = Math.min(index + step, itemCount - 1)
                break
            }
            case 'ArrowUp': {
                e.preventDefault()
                const step = displayMode === 'grid' ? getColumnCount() : 1
                newIndex = Math.max(index - step, 0)
                break
            }
            case 'f':
            case 'F':
                e.preventDefault()
                toggleFavorite(item.id, item.title)
                return
            case 'c':
            case 'C':
                if (!enableCompare) return
                e.preventDefault()
                handleCompareKey(item, index)
                return
            case 'Home':
                e.preventDefault()
                newIndex = 0
                break
            case 'End':
                e.preventDefault()
                newIndex = itemCount - 1
                break
            default:
                return
        }

        if (newIndex !== index) {
            setFocusedIndex(newIndex)
            itemRefs.current[newIndex]?.focus()
        }
    }, [visibleBasemaps.length, handleBasemapClick, displayMode, getColumnCount, toggleFavorite, enableCompare, handleCompareKey])

    // Keep the active item visible when the selection moves, including when
    // another widget or bookmark changes the basemap
    useEffect(() => {
        if (!activeBasemapId) return
        const idx = visibleBasemaps.findIndex(b => b.id === activeBasemapId)
        if (idx >= 0) {
            itemRefs.current[idx]?.scrollIntoView({ block: 'nearest' })
        }
    }, [activeBasemapId, visibleBasemaps])

    const handleThumbError = useCallback((id: string) => {
        setBrokenThumbs(prev => ({ ...prev, [id]: true }))
    }, [])

    const activeViewChangeHandler = (jmv: JimuMapView) => {
        // The overlay belongs to the previous view; the effect cleanup removes it
        setCompareMode(false)
        setCompareBasemapId(null)
        setCompareLoading(false)
        setCompareError(null)
        if (jmv) {
            setJimuMapView(jmv)
            setIsLoading(true)
        } else {
            setJimuMapView(null)
            setLoadedBasemaps([])
            setIsLoading(false)
        }
    }

    // Roving tabindex: exactly one tab stop in the gallery at all times
    const tabStopIndex = focusedIndex >= 0 && focusedIndex < visibleBasemaps.length
        ? focusedIndex
        : 0

    const style = css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: auto;
    background: var(--ref-palette-white);

    /* Screen reader only content */
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* Live region for announcements */
    .status-announcer {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* Filter, Compare and Help (and the compare bar) stay visible while the gallery scrolls */
    .gallery-sticky {
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--ref-palette-white);
      border-bottom: 1px solid var(--ref-palette-neutral-300);
      flex-shrink: 0;
      min-width: 0;
    }

    /* Compare reads as a tool: icon plus a text label, outlined when off, filled when on */
    .compare-toggle {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      font-weight: 600;
    }

    .compare-toggle .compare-toggle-label {
      line-height: 1;
    }

    .gallery-header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: nowrap;
      gap: 8px;
      padding: 6px ${sizeConfig.padding}px;
      flex-shrink: 0;
      min-width: 0;
    }

    .search-container {
      flex: 1 1 0%;
      min-width: 0;
    }

    /* Compare bar: slider between the two basemap names, plus a close button */
    .compare-bar {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 4px ${sizeConfig.padding}px 8px ${sizeConfig.padding}px;
      border-top: 1px solid var(--ref-palette-neutral-300);
      flex-shrink: 0;
      min-width: 0;
    }

    .compare-labels {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: var(--ref-palette-neutral-1100);
      min-width: 0;
    }

    .compare-label {
      flex: 1 1 0%;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .compare-label.right {
      text-align: right;
    }

    .compare-label .side {
      font-weight: 600;
      color: var(--ref-palette-neutral-900);
      margin-right: 4px;
    }

    .compare-label.right .side {
      margin-right: 0;
      margin-left: 4px;
    }

    .compare-slider {
      width: 100%;
      min-width: 0;
    }

    .compare-prompt {
      font-size: 12px;
      color: var(--ref-palette-neutral-1000);
      padding: 2px 0;
    }

    .compare-error {
      font-size: 12px;
      color: var(--sys-color-error-dark, #c62828);
      padding: 2px 0;
    }

    /* Basemap currently on the left side of the divider */
    .gallery-container .compare-indicator {
      position: absolute;
      bottom: ${sizeConfig.gap / 2}px;
      right: ${sizeConfig.gap / 2}px;
      background: var(--ref-palette-neutral-1100);
      color: white;
      border-radius: 4px;
      padding: 0 6px;
      height: ${sizeConfig.indicatorSize}px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: ${Math.max(9, sizeConfig.indicatorFontSize - 3)}px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    .gallery-container .compare-indicator.right {
      background: var(--sys-color-primary-main);
    }

    .grid-mode .basemap-item.comparing {
      border-color: var(--ref-palette-neutral-1100);
      border-style: dashed;
    }

    .list-mode .basemap-item.comparing {
      border-color: var(--ref-palette-neutral-1100);
      border-style: dashed;
    }

    .list-mode .compare-indicator {
      position: static;
      margin-left: ${listSizeConfig.gap}px;
      flex-shrink: 0;
      height: ${listSizeConfig.indicatorSize}px;
      font-size: ${Math.max(9, listSizeConfig.indicatorFontSize - 2)}px;
    }

    .partial-failure-notice {
      margin: ${sizeConfig.padding}px ${sizeConfig.padding}px 0 ${sizeConfig.padding}px;
      padding: 6px 10px;
      font-size: 12px;
      border-radius: 4px;
      color: var(--sys-color-error-dark, #c62828);
      background: var(--sys-color-error-light, #fdecea);
      flex-shrink: 0;
    }

    .no-results {
      padding: 20px;
      text-align: center;
      font-size: 13px;
      color: var(--ref-palette-neutral-1000);
    }

    /* Grid mode styles */
    .gallery-container.grid-mode {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(${sizeConfig.minWidth}px, 1fr));
      gap: ${sizeConfig.gap}px;
      padding: ${sizeConfig.padding}px;
    }

    .grid-mode .basemap-item {
      display: flex;
      flex-direction: column;
      cursor: pointer;
      border: ${sizeConfig.borderWidth}px solid var(--ref-palette-neutral-400);
      border-radius: 6px;
      overflow: hidden;
      background: var(--ref-palette-white);
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.1s;
      position: relative;
      padding: 0;
      font: inherit;
      color: inherit;
      text-align: left;

      /* WCAG 1.4.11 - Non-text contrast 3:1 minimum for UI components */
      &:hover {
        border-color: var(--sys-color-primary-main);
        transform: translateY(-2px);
      }

      /* WCAG 2.4.7 - Focus Visible - High contrast focus indicator */
      &:focus {
        outline: none;
        border-color: var(--sys-color-primary-dark, #005a9e);
        box-shadow: 
          0 0 0 3px var(--ref-palette-white),
          0 0 0 6px var(--sys-color-primary-dark, #005a9e);
      }

      &:focus-visible {
        outline: none;
        border-color: var(--sys-color-primary-dark, #005a9e);
        box-shadow: 
          0 0 0 3px var(--ref-palette-white),
          0 0 0 6px var(--sys-color-primary-dark, #005a9e);
      }

      /* WCAG 1.4.1 - Use of Color - Not only color indicates selection (also checkmark) */
      &.active {
        border-color: var(--sys-color-primary-main);
        box-shadow: 0 0 0 3px var(--sys-color-primary-light);
      }

      &.active:focus,
      &.active:focus-visible {
        box-shadow: 
          0 0 0 3px var(--ref-palette-white),
          0 0 0 6px var(--sys-color-primary-dark, #005a9e);
      }
    }

    /* WCAG 2.3.3 - Respect reduced motion preference */
    @media (prefers-reduced-motion: reduce) {
      .grid-mode .basemap-item,
      .list-mode .basemap-item {
        transition: none;
      }
      .grid-mode .basemap-item:hover {
        transform: none;
      }
      .skeleton-item,
      .gallery-container .active-indicator {
        animation: none;
      }
      .fav-btn {
        transition: none;
      }
    }

    .grid-mode .basemap-thumbnail {
      width: 100%;
      aspect-ratio: 4/3;
      object-fit: cover;
      background: var(--ref-palette-neutral-300);
    }

    /* WCAG 1.4.3 - Contrast minimum 4.5:1 for text */
    .grid-mode .basemap-title {
      padding: ${sizeConfig.titlePadding};
      font-size: ${sizeConfig.fontSize}px;
      font-weight: 500;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--ref-palette-neutral-1100);
      background: var(--ref-palette-white);
    }

    .grid-mode .active-indicator {
      position: absolute;
      top: ${sizeConfig.gap / 2}px;
      right: ${sizeConfig.gap / 2}px;
      background: var(--sys-color-primary-main);
      color: white;
      border-radius: 50%;
      width: ${sizeConfig.indicatorSize}px;
      height: ${sizeConfig.indicatorSize}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${sizeConfig.indicatorFontSize}px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }

    /* List mode styles */
    .gallery-container.list-mode {
      display: flex;
      flex-direction: column;
      gap: ${listSizeConfig.gap}px;
      padding: ${listSizeConfig.padding}px;
    }

    .list-mode .basemap-item {
      display: flex;
      flex-direction: row;
      align-items: center;
      cursor: pointer;
      border: ${listSizeConfig.borderWidth}px solid var(--ref-palette-neutral-400);
      border-radius: 6px;
      overflow: hidden;
      background: var(--ref-palette-white);
      transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
      position: relative;
      padding: ${listSizeConfig.itemPadding};
      font: inherit;
      color: inherit;
      text-align: left;

      &:hover {
        border-color: var(--sys-color-primary-main);
        background: var(--ref-palette-neutral-100);
      }

      /* WCAG 2.4.7 - High contrast focus indicator */
      &:focus {
        outline: none;
        border-color: var(--sys-color-primary-dark, #005a9e);
        box-shadow: 
          0 0 0 2px var(--ref-palette-white),
          0 0 0 4px var(--sys-color-primary-dark, #005a9e);
      }

      &:focus-visible {
        outline: none;
        border-color: var(--sys-color-primary-dark, #005a9e);
        box-shadow: 
          0 0 0 2px var(--ref-palette-white),
          0 0 0 4px var(--sys-color-primary-dark, #005a9e);
      }

      /* Active state - outline style like grid mode */
      &.active {
        border-color: var(--sys-color-primary-main);
        box-shadow: 0 0 0 3px var(--sys-color-primary-light);
        background: var(--ref-palette-white);
      }

      &.active:hover {
        background: var(--ref-palette-neutral-100);
      }

      &.active:focus,
      &.active:focus-visible {
        box-shadow: 
          0 0 0 2px var(--ref-palette-white),
          0 0 0 4px var(--sys-color-primary-dark, #005a9e);
      }
    }

    .list-mode .basemap-thumbnail {
      width: ${listSizeConfig.thumbnailSize}px;
      height: ${listSizeConfig.thumbnailSize}px;
      object-fit: cover;
      background: var(--ref-palette-neutral-300);
      border-radius: 4px;
      flex-shrink: 0;
      margin-right: ${listSizeConfig.gap + 4}px;
    }

    /* WCAG 1.4.3 - Contrast minimum 4.5:1 for text */
    .list-mode .basemap-title {
      flex: 1;
      font-size: ${listSizeConfig.fontSize}px;
      font-weight: 500;
      color: var(--ref-palette-neutral-1100);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* WCAG 1.4.1 - Active indicator provides non-color indication of selection */
    .list-mode .active-indicator {
      background: var(--sys-color-primary-main);
      color: white;
      border-radius: 50%;
      width: ${listSizeConfig.indicatorSize}px;
      height: ${listSizeConfig.indicatorSize}px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: ${listSizeConfig.indicatorFontSize}px;
      font-weight: bold;
      margin-left: ${listSizeConfig.gap}px;
      flex-shrink: 0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .fav-btn {
      border: none;
      cursor: pointer;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      line-height: 1;
      opacity: 0;
      transition: opacity 0.15s;
      background: rgba(255,255,255,0.85);
      color: var(--ref-palette-neutral-800);
    }

    .basemap-item:hover .fav-btn,
    .basemap-item:focus .fav-btn,
    .basemap-item:focus-within .fav-btn,
    .fav-btn.is-fav {
      opacity: 1;
    }

    .fav-btn.is-fav {
      color: var(--sys-color-warning-main, #f5a623);
    }

    .grid-mode .fav-btn {
      position: absolute;
      top: ${sizeConfig.gap / 2}px;
      left: ${sizeConfig.gap / 2}px;
      width: ${sizeConfig.indicatorSize}px;
      height: ${sizeConfig.indicatorSize}px;
      font-size: ${sizeConfig.indicatorFontSize}px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .list-mode .fav-btn {
      width: ${listSizeConfig.indicatorSize}px;
      height: ${listSizeConfig.indicatorSize}px;
      font-size: ${listSizeConfig.indicatorFontSize}px;
      margin-left: ${listSizeConfig.gap}px;
      flex-shrink: 0;
      background: transparent;
      box-shadow: none;
    }

    /* Selection checkmark pops in briefly */
    .gallery-container .active-indicator {
      animation: bgc-pop 0.15s ease-out;
    }

    @keyframes bgc-pop {
      from { transform: scale(0.5); }
      to { transform: scale(1); }
    }

    /* Skeleton placeholders shown while basemaps load */
    .skeleton-item {
      border: 1px solid var(--ref-palette-neutral-300);
      border-radius: 6px;
      overflow: hidden;
      animation: bgc-pulse 1.2s ease-in-out infinite;
    }

    .grid-mode .skeleton-thumb {
      width: 100%;
      aspect-ratio: 4/3;
      background: var(--ref-palette-neutral-300);
    }

    .grid-mode .skeleton-line {
      height: ${sizeConfig.fontSize + 6}px;
      margin: 6px;
      border-radius: 3px;
      background: var(--ref-palette-neutral-300);
    }

    .list-mode .skeleton-item {
      display: flex;
      align-items: center;
      padding: ${listSizeConfig.itemPadding};
    }

    .list-mode .skeleton-thumb {
      width: ${listSizeConfig.thumbnailSize}px;
      height: ${listSizeConfig.thumbnailSize}px;
      border-radius: 4px;
      background: var(--ref-palette-neutral-300);
      flex-shrink: 0;
      margin-right: ${listSizeConfig.gap + 4}px;
    }

    .list-mode .skeleton-line {
      flex: 1;
      height: ${listSizeConfig.fontSize + 2}px;
      border-radius: 3px;
      background: var(--ref-palette-neutral-300);
    }

    @keyframes bgc-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }

    .loading-container,
    .error-container,
    .empty-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 100%;
      min-height: 150px;
      padding: 20px;
      text-align: center;
      color: var(--ref-palette-neutral-1000);
      font-size: 14px;
    }

    .error-container {
      color: var(--sys-color-error-dark, #c62828);
    }

    .instructions {
      margin-top: 8px;
      font-size: 12px;
      color: var(--ref-palette-neutral-800);
    }
  `

    const configBasemaps = props.config?.basemaps as BasemapItem[] | undefined
    const hasConfiguredBasemaps = configBasemaps && configBasemaps.length > 0
    const showGallery = Boolean(hasMapWidget && jimuMapView && !isLoading && !error && loadedBasemaps.length > 0)
    const showCompare = showGallery && enableCompare
    const compareItem = compareBasemapId ? loadedBasemaps.find(b => b.id === compareBasemapId) : undefined
    const activeItem = activeBasemapId ? loadedBasemaps.find(b => b.id === activeBasemapId) : undefined
    const helpFeatures: HelpFeatures = {
        mapConnected: hasMapWidget,
        galleryAvailable: showGallery,
        listView: showGallery && displayMode === 'list',
        search: showGallery && showSearch,
        favorites: showGallery,
        compare: showCompare,
        comparing: showCompare && compareMode,
        defaultBasemap: showGallery && loadedBasemaps.some(item => item.id === props.config?.defaultBasemapId),
        activeIndicator: showGallery && visibleBasemaps.some(item => item.id === activeBasemapId),
        loading: hasMapWidget && (isLoading || !jimuMapView),
        empty: Boolean(hasMapWidget && jimuMapView && !isLoading && !error && !hasConfiguredBasemaps),
        loadError: Boolean(hasMapWidget && jimuMapView && !isLoading && (error || (hasConfiguredBasemaps && loadedBasemaps.length === 0))),
        partialFailure: showGallery && failedCount > 0,
        missingThumbnail: showGallery && visibleBasemaps.some(item => !item.thumbnailUrl || brokenThumbs[item.id])
    }
    // The happy path is shown only when the gallery can actually be used.
    const hintT = (id: string): string => t(id === 'firstRunBody' && !showGallery ? 'firstRunBodyWaiting' : id)

    return (
        <div
            className='jimu-widget'
            css={style}
            role='region'
            aria-label='Basemap Gallery Widget'
        >
            {/* WCAG 4.1.3 - Live region for screen reader announcements */}
            <div
                ref={statusRef}
                className='status-announcer'
                role='status'
                aria-live='polite'
                aria-atomic='true'
            />

            {hasMapWidget && (
                <JimuMapViewComponent
                    useMapWidgetId={props.useMapWidgetIds[0]}
                    onActiveViewChange={activeViewChangeHandler}
                />
            )}

            {/* Sticky top: the header row and the compare bar stay put while the gallery scrolls */}
            <div className='gallery-sticky'>
            {/* Keep the filter, Compare and Help on one row, including in narrow panels. */}
            <div className='gallery-header'>
                {showGallery && showSearch && (
                    <div className='search-container'>
                        <TextInput
                            placeholder={t('filterPlaceholder')}
                            value={searchText}
                            onChange={handleSearchChange}
                            allowClear
                            aria-label={t('filterLabel')}
                            type='search'
                            style={{ width: '100%', minWidth: 0 }}
                        />
                    </div>
                )}
                {showCompare && (
                    <Tooltip title={t(compareMode ? 'compareOffTip' : 'compareOnTip')} placement='bottom'>
                        <Button
                            size='sm'
                            type={compareMode ? 'primary' : 'secondary'}
                            className='compare-toggle'
                            onClick={toggleCompareMode}
                            title={t(compareMode ? 'compareOff' : 'compareOn')}
                            aria-label={t(compareMode ? 'compareOff' : 'compareOn')}
                            aria-pressed={compareMode}
                            style={{ flexShrink: 0 }}
                        >
                            <CalciteIcon icon='compare' scale='s' />
                            <span className='compare-toggle-label' aria-hidden='true'>
                                {t(compareMode ? 'compareOffShort' : 'compareOnShort')}
                            </span>
                        </Button>
                    </Tooltip>
                )}
                <Button size="sm" type="tertiary" icon onClick={onHelp} title={t('helpTitle')} aria-label={t('helpTitle')} style={{ flexShrink: 0 }}>
                  <CalciteIcon icon="question" scale="s" />
                </Button>
            </div>

            {/* Compare bar: shown while compare is on. The slider mirrors the on-map divider. */}
            {showCompare && compareMode && (
                <div className='compare-bar' role='group' aria-label={t('compareGroupLabel')}>
                    {compareError && (
                        <div className='compare-error' role='alert'>{compareError}</div>
                    )}
                    {!compareItem && !compareError && (
                        <div className='compare-prompt' role='status'>
                            {compareLoading ? t('compareLoading') : t('comparePrompt')}
                        </div>
                    )}
                    {compareItem && (
                        <>
                            <div className='compare-labels' aria-hidden='true'>
                                <span className='compare-label' title={compareItem.title}>
                                    <span className='side'>{t('compareLeft')}</span>{compareItem.title}
                                </span>
                                <span className='compare-label right' title={activeItem?.title || ''}>
                                    {activeItem?.title || t('compareCurrent')}<span className='side'>{t('compareRight')}</span>
                                </span>
                            </div>
                            <CalciteSlider
                                className='compare-slider'
                                min={0}
                                max={100}
                                step={1}
                                value={comparePosition}
                                scale='s'
                                labelHandles
                                disabled={compareLoading}
                                label={t('compareSliderLabel', { left: compareItem.title, right: activeItem?.title || t('compareCurrent') })}
                                onCalciteSliderInput={handleCompareSlider}
                                onCalciteSliderChange={handleCompareSlider}
                            />
                        </>
                    )}
                </div>
            )}
            </div>
            <div style={{ flexShrink: 0 }}>
                <FirstRunHint
                    showFirstRunHint={showFirstRunHint}
                    t={hintT}
                    onOpenHelp={onOpenHelp}
                    onDismissHint={onDismissHint}
                />
            </div>
            <HelpPopup
                open={helpOpen}
                onClose={() => { setHelpOpen(false) }}
                sections={buildHelpSections(t, helpFeatures)}
                title={t('helpTitle')}
                intro={t('helpIntro')}
                searchPlaceholder={t('helpSearchPlaceholder')}
                noMatches={t('helpNoMatches')}
                closeLabel={t('close')}
            />

            {/* No map widget connected - prompt instead of an endless spinner */}
            {!hasMapWidget && (
                <div
                    className='empty-container'
                    role='status'
                    aria-label='No map widget connected'
                >
                    <span>No map connected.</span>
                    <span className='instructions'>Select a map widget in the widget settings.</span>
                </div>
            )}

            {/* WCAG 4.1.3 - Loading state announcement */}
            {hasMapWidget && (isLoading || !jimuMapView) && !hasConfiguredBasemaps && (
                <div
                    className='loading-container'
                    role='status'
                    aria-busy='true'
                    aria-label='Loading basemaps'
                >
                    <Loading />
                    <span className='mt-2' aria-hidden='true'>Loading basemaps...</span>
                </div>
            )}

            {/* Skeleton placeholders sized to the configured gallery */}
            {hasMapWidget && (isLoading || !jimuMapView) && hasConfiguredBasemaps && (
                <div
                    className={`gallery-container ${displayMode === 'list' ? 'list-mode' : 'grid-mode'}`}
                    role='status'
                    aria-busy='true'
                    aria-label='Loading basemaps'
                >
                    {Array.from({ length: Math.min(configBasemaps.length, 12) }).map((_, i) => (
                        <div key={i} className='skeleton-item' aria-hidden='true'>
                            <div className='skeleton-thumb' />
                            <div className='skeleton-line' />
                        </div>
                    ))}
                </div>
            )}

            {/* WCAG 4.1.3 - Error state announcement */}
            {hasMapWidget && jimuMapView && !isLoading && error && (
                <div
                    className='error-container'
                    role='alert'
                    aria-live='assertive'
                >
                    <span aria-hidden='true'>⚠️</span>
                    <span className='mt-2'>{error}</span>
                </div>
            )}

            {/* Empty state - no basemaps configured */}
            {hasMapWidget && jimuMapView && !isLoading && !error && !hasConfiguredBasemaps && (
                <div
                    className='empty-container'
                    role='status'
                    aria-label='No basemaps configured'
                >
                    <span>No basemaps configured.</span>
                    <span className='instructions'>Add basemaps in the widget settings.</span>
                </div>
            )}

            {/* Empty state - basemaps failed to load */}
            {hasMapWidget && jimuMapView && !isLoading && !error && hasConfiguredBasemaps && loadedBasemaps.length === 0 && (
                <div
                    className='empty-container'
                    role='alert'
                    aria-label='Basemaps could not be loaded'
                >
                    <span>No basemaps could be loaded.</span>
                    <span className='instructions'>Check the item IDs and portal URL in settings.</span>
                </div>
            )}

            {showGallery && (
                <>
                    {/* Partial failure notice when some configured items failed */}
                    {failedCount > 0 && (
                        <div className='partial-failure-notice' role='status'>
                            {failedCount} basemap{failedCount !== 1 ? 's' : ''} could not be loaded. Check the item IDs in settings.
                        </div>
                    )}

                    {/* WCAG 4.1.3 - Status messages for screen readers */}
                    <div className='sr-only' id='basemap-instructions'>
                        Basemap gallery with {visibleBasemaps.length} basemap{visibleBasemaps.length !== 1 ? 's' : ''} available.
                        Use arrow keys to navigate between basemaps.
                        Press Enter or Space to select and apply a basemap to the map.
                        Home key jumps to first basemap, End key jumps to last basemap.
                        Press F to add or remove the focused basemap from favorites. Favorites are pinned to the top of the gallery.
                        {showCompare && ' Press C to compare the focused basemap with the current basemap using a divider on the map.'}
                        {showCompare && compareMode && ' Compare is on: Enter or Space chooses the basemap for the left side of the divider instead of applying it.'}
                        {activeBasemapId && ` Currently selected: ${loadedBasemaps.find(b => b.id === activeBasemapId)?.title || 'Unknown'}.`}
                        {compareItem && ` Comparing: ${compareItem.title} on the left.`}
                    </div>

                    {/* No matches for the current search */}
                    {visibleBasemaps.length === 0 && (
                        <div className='no-results' role='status'>
                            No basemaps match "{searchText}".
                        </div>
                    )}

                    {/* WCAG 4.1.2 - Name, Role, Value - Proper listbox semantics */}
                    {visibleBasemaps.length > 0 && (
                        <div
                            ref={galleryRef}
                            className={`gallery-container ${displayMode === 'list' ? 'list-mode' : 'grid-mode'}`}
                            role='listbox'
                            aria-label={`Basemap selection gallery - ${displayMode === 'list' ? 'list view' : 'grid view'}`}
                            aria-describedby='basemap-instructions'
                            aria-activedescendant={activeBasemapId ? `basemap-${activeBasemapId}` : undefined}
                        >
                            {visibleBasemaps.map((item, index) => {
                                const isActive = activeBasemapId === item.id
                                const isFav = favorites.includes(item.id)
                                const isComparing = showCompare && compareBasemapId === item.id
                                // While compare is on, the current basemap is the right side of the divider
                                const isRightSide = showCompare && compareMode && isActive && compareBasemapId !== null
                                const thumbBroken = brokenThumbs[item.id]
                                const tooltipContent = showCompare && compareMode
                                    ? (isActive
                                        ? `${item.title} - Current basemap, shown on the right side`
                                        : isComparing
                                            ? `${item.title} - Shown on the left side of the divider`
                                            : `Click to compare ${item.title} with the current basemap`)
                                    : isActive
                                        ? `${item.title} - Currently active basemap (click to reapply)`
                                        : `Click to apply ${item.title} basemap to the map`

                                return (
                                    <Tooltip
                                        key={item.id}
                                        title={tooltipContent}
                                        placement={displayMode === 'list' ? 'left' : 'top'}
                                        enterDelay={300}
                                        enterNextDelay={300}
                                    >
                                        <div
                                            ref={el => { itemRefs.current[index] = el }}
                                            id={`basemap-${item.id}`}
                                            className={`basemap-item ${isActive ? 'active' : ''} ${isComparing ? 'comparing' : ''}`}
                                            onClick={() => handleBasemapClick(item, index)}
                                            onMouseEnter={() => { void preloadBasemap(item).catch(() => undefined) }}
                                            onFocus={() => { void preloadBasemap(item).catch(() => undefined) }}
                                            onKeyDown={(e) => handleKeyDown(e, item, index)}
                                            role='option'
                                            aria-selected={isActive}
                                            aria-label={`${item.title}${isActive ? ', currently selected basemap' : ''}${isComparing ? ', shown on the left side for comparison' : ''}${isRightSide ? ', shown on the right side for comparison' : ''}${isFav ? ', favorite' : ''}, ${index + 1} of ${visibleBasemaps.length}`}
                                            aria-posinset={index + 1}
                                            aria-setsize={visibleBasemaps.length}
                                            tabIndex={index === tabStopIndex ? 0 : -1}
                                        >
                                            {/* WCAG 1.1.1 - Decorative images hidden from screen readers */}
                                            {item.thumbnailUrl && !thumbBroken ? (
                                                <img
                                                    className='basemap-thumbnail'
                                                    src={item.thumbnailUrl}
                                                    alt=''
                                                    aria-hidden='true'
                                                    draggable='false'
                                                    loading='lazy'
                                                    decoding='async'
                                                    onError={() => handleThumbError(item.id)}
                                                />
                                            ) : (
                                                <div
                                                    className='basemap-thumbnail'
                                                    aria-hidden='true'
                                                    role='presentation'
                                                />
                                            )}
                                            <div className='basemap-title' title={item.title}>
                                                {item.title}
                                            </div>
                                            {/* Favorite star. Hidden from AT; keyboard users press F, and the item label announces favorite state */}
                                            <button
                                                className={`fav-btn ${isFav ? 'is-fav' : ''}`}
                                                tabIndex={-1}
                                                aria-hidden='true'
                                                title={t(isFav ? 'favoriteRemove' : 'favoriteAdd')}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleFavorite(item.id, item.title)
                                                }}
                                            >
                                                ★
                                            </button>
                                            {/* Compare badge: this basemap is on the left side of the divider */}
                                            {isComparing && (
                                                <Tooltip title={t('compareIndicatorLabel')} placement='left'>
                                                    <div
                                                        className='compare-indicator'
                                                        aria-hidden='true'
                                                        role='presentation'
                                                    >
                                                        <CalciteIcon icon='compare' scale='s' />
                                                        {t('compareLeft')}
                                                    </div>
                                                </Tooltip>
                                            )}
                                            {/* Compare badge: the current basemap is on the right side of the divider */}
                                            {isRightSide && (
                                                <Tooltip title={t('compareRightIndicatorLabel')} placement='left'>
                                                    <div
                                                        className='compare-indicator right'
                                                        aria-hidden='true'
                                                        role='presentation'
                                                    >
                                                        <CalciteIcon icon='compare' scale='s' />
                                                        {t('compareRight')}
                                                    </div>
                                                </Tooltip>
                                            )}
                                            {/* WCAG 1.4.1 - Non-color indicator for active state */}
                                            {isActive && (
                                                <Tooltip title={t('activeBasemapLabel')} placement='left'>
                                                    <div
                                                        className='active-indicator'
                                                        aria-hidden='true'
                                                        role='presentation'
                                                    >
                                                        ✓
                                                    </div>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </Tooltip>
                                )
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

export default Widget
