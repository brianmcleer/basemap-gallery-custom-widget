import { React, css } from 'jimu-core'
import { type AllWidgetProps } from 'jimu-core'
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import { Loading, Tooltip, TextInput } from 'jimu-ui'
import Basemap from 'esri/Basemap'
import Portal from 'esri/portal/Portal'
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
}

// Number of basemaps at which the search filter appears
const SEARCH_THRESHOLD = 8

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

const Widget = (props: AllWidgetProps<Config>) => {
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
    // Tracks which map views have already had the default basemap applied,
    // so the default applies once on load and never fights the user afterward
    const defaultAppliedRef = useRef<Record<string, boolean>>({})

    const size = props.config?.size || 'md'
    const displayMode = props.config?.displayMode || 'grid'
    const sizeConfig = SIZE_CONFIG[size]
    const listSizeConfig = LIST_SIZE_CONFIG[size]
    const hasMapWidget = props.useMapWidgetIds?.length === 1

    // WCAG 4.1.3 - Announce status changes to screen readers
    const announceStatus = useCallback((message: string) => {
        if (statusRef.current) {
            statusRef.current.textContent = message
        }
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
    }, [jimuMapView, props.config?.portalUrl, props.config?.basemaps, props.config?.defaultBasemapId, announceStatus])

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

    const handleBasemapClick = useCallback((item: LoadedBasemap, index: number) => {
        if (!jimuMapView?.view?.map) return

        jimuMapView.view.map.basemap = item.basemap
        setActiveBasemapId(item.id)
        setFocusedIndex(index)
        // WCAG 4.1.3 - Announce selection to screen readers
        announceStatus(`${item.title} basemap applied to map`)
    }, [jimuMapView, announceStatus])

    const toggleFavorite = useCallback((id: string, title: string) => {
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
    }, [visibleBasemaps.length, handleBasemapClick, displayMode, getColumnCount, toggleFavorite])

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

    .search-container {
      padding: ${sizeConfig.padding}px ${sizeConfig.padding}px 0 ${sizeConfig.padding}px;
      flex-shrink: 0;
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

            {hasMapWidget && jimuMapView && !isLoading && !error && loadedBasemaps.length > 0 && (
                <>
                    {/* Partial failure notice when some configured items failed */}
                    {failedCount > 0 && (
                        <div className='partial-failure-notice' role='status'>
                            {failedCount} basemap{failedCount !== 1 ? 's' : ''} could not be loaded. Check the item IDs in settings.
                        </div>
                    )}

                    {/* Search filter for large galleries */}
                    {showSearch && (
                        <div className='search-container'>
                            <TextInput
                                placeholder='Filter basemaps...'
                                value={searchText}
                                onChange={handleSearchChange}
                                allowClear
                                aria-label='Filter basemaps by name'
                                type='search'
                            />
                        </div>
                    )}

                    {/* WCAG 4.1.3 - Status messages for screen readers */}
                    <div className='sr-only' id='basemap-instructions'>
                        Basemap gallery with {visibleBasemaps.length} basemap{visibleBasemaps.length !== 1 ? 's' : ''} available.
                        Use arrow keys to navigate between basemaps.
                        Press Enter or Space to select and apply a basemap to the map.
                        Home key jumps to first basemap, End key jumps to last basemap.
                        Press F to add or remove the focused basemap from favorites. Favorites are pinned to the top of the gallery.
                        {activeBasemapId && ` Currently selected: ${loadedBasemaps.find(b => b.id === activeBasemapId)?.title || 'Unknown'}.`}
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
                                const thumbBroken = brokenThumbs[item.id]
                                const tooltipContent = isActive
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
                                            className={`basemap-item ${isActive ? 'active' : ''}`}
                                            onClick={() => handleBasemapClick(item, index)}
                                            onKeyDown={(e) => handleKeyDown(e, item, index)}
                                            role='option'
                                            aria-selected={isActive}
                                            aria-label={`${item.title}${isActive ? ', currently selected basemap' : ''}${isFav ? ', favorite' : ''}, ${index + 1} of ${visibleBasemaps.length}`}
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
                                                title={isFav ? 'Remove from favorites' : 'Add to favorites (pins to top)'}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    toggleFavorite(item.id, item.title)
                                                }}
                                            >
                                                ★
                                            </button>
                                            {/* WCAG 1.4.1 - Non-color indicator for active state */}
                                            {isActive && (
                                                <Tooltip title='Currently active basemap' placement='left'>
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