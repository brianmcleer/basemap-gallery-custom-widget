import { React, css } from 'jimu-core'
import { type AllWidgetProps } from 'jimu-core'
import { JimuMapView, JimuMapViewComponent } from 'jimu-arcgis'
import { Loading, Tooltip } from 'jimu-ui'
import Basemap from 'esri/Basemap'
import Portal from 'esri/portal/Portal'

const { useEffect, useState, useRef, useCallback } = React

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
    const [isLoading, setIsLoading] = useState(true)
    const [loadedBasemaps, setLoadedBasemaps] = useState<LoadedBasemap[]>([])
    const [activeBasemapId, setActiveBasemapId] = useState<string>(null)
    const [error, setError] = useState<string>(null)
    const [focusedIndex, setFocusedIndex] = useState<number>(-1)
    const galleryRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
    const statusRef = useRef<HTMLDivElement>(null)

    const size = props.config?.size || 'md'
    const displayMode = props.config?.displayMode || 'grid'
    const sizeConfig = SIZE_CONFIG[size]
    const listSizeConfig = LIST_SIZE_CONFIG[size]

    // WCAG 4.1.3 - Announce status changes to screen readers
    const announceStatus = useCallback((message: string) => {
        if (statusRef.current) {
            statusRef.current.textContent = message
        }
    }, [])

    // Load basemaps when config changes
    useEffect(() => {
        if (!jimuMapView?.view) return

        let destroyed = false

        const loadBasemaps = async () => {
            setIsLoading(true)
            setError(null)
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

                const loaded: LoadedBasemap[] = []

                for (const item of configBasemaps) {
                    if (destroyed) return

                    try {
                        const basemap = new Basemap({
                            portalItem: {
                                id: item.id,
                                portal: portal
                            }
                        })

                        await basemap.load()

                        loaded.push({
                            id: item.id,
                            title: basemap.title || item.title,
                            thumbnailUrl: basemap.thumbnailUrl || item.thumbnailUrl || '',
                            basemap: basemap
                        })
                    } catch (err) {
                        console.warn(`Failed to load basemap ${item.id}:`, err)
                    }
                }

                if (!destroyed) {
                    setLoadedBasemaps(loaded)

                    // Track current basemap on the map (don't change it)
                    const currentBasemapId = jimuMapView.view.map?.basemap?.portalItem?.id
                    if (currentBasemapId) {
                        const matchingBasemap = loaded.find(b => b.id === currentBasemapId)
                        if (matchingBasemap) {
                            setActiveBasemapId(currentBasemapId)
                        }
                    }

                    // If no current basemap detected but we have a default configured, mark it as active for UI
                    if (!activeBasemapId && props.config?.defaultBasemapId) {
                        const defaultBasemap = loaded.find(b => b.id === props.config.defaultBasemapId)
                        if (defaultBasemap) {
                            setActiveBasemapId(defaultBasemap.id)
                        }
                    }

                    setIsLoading(false)
                    announceStatus(`${loaded.length} basemap${loaded.length !== 1 ? 's' : ''} loaded. Use arrow keys to navigate, Enter or Space to select.`)
                }
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
    }, [jimuMapView, props.config?.portalUrl, props.config?.basemaps, announceStatus])

    // Track active basemap
    useEffect(() => {
        if (!jimuMapView?.view?.map) return

        const currentBasemap = jimuMapView.view.map.basemap
        if (currentBasemap?.portalItem?.id) {
            setActiveBasemapId(currentBasemap.portalItem.id)
        }
    }, [jimuMapView, loadedBasemaps])

    const handleBasemapClick = useCallback((item: LoadedBasemap, index: number) => {
        if (!jimuMapView?.view?.map) return

        jimuMapView.view.map.basemap = item.basemap
        setActiveBasemapId(item.id)
        setFocusedIndex(index)
        // WCAG 4.1.3 - Announce selection to screen readers
        announceStatus(`${item.title} basemap applied to map`)
    }, [jimuMapView, announceStatus])

    // WCAG 2.1.1 - Keyboard navigation handler
    const handleKeyDown = useCallback((e: React.KeyboardEvent, item: LoadedBasemap, index: number) => {
        const itemCount = loadedBasemaps.length
        let newIndex = index

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault()
                handleBasemapClick(item, index)
                break
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault()
                newIndex = (index + 1) % itemCount
                break
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault()
                newIndex = (index - 1 + itemCount) % itemCount
                break
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
    }, [loadedBasemaps.length, handleBasemapClick])

    const activeViewChangeHandler = (jmv: JimuMapView) => {
        if (jmv) {
            setJimuMapView(jmv)
            setIsLoading(true)
        }
    }

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

            {props.useMapWidgetIds?.length === 1 && (
                <JimuMapViewComponent
                    useMapWidgetId={props.useMapWidgetIds[0]}
                    onActiveViewChange={activeViewChangeHandler}
                />
            )}

            {/* WCAG 4.1.3 - Loading state announcement */}
            {isLoading && (
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

            {/* WCAG 4.1.3 - Error state announcement */}
            {!isLoading && error && (
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
            {!isLoading && !error && !hasConfiguredBasemaps && (
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
            {!isLoading && !error && hasConfiguredBasemaps && loadedBasemaps.length === 0 && (
                <div
                    className='empty-container'
                    role='alert'
                    aria-label='Basemaps could not be loaded'
                >
                    <span>No basemaps could be loaded.</span>
                    <span className='instructions'>Check the item IDs and portal URL in settings.</span>
                </div>
            )}

            {!isLoading && !error && loadedBasemaps.length > 0 && (
                <>
                    {/* WCAG 4.1.3 - Status messages for screen readers */}
                    <div className='sr-only' id='basemap-instructions'>
                        Basemap gallery with {loadedBasemaps.length} basemap{loadedBasemaps.length !== 1 ? 's' : ''} available.
                        Use left and right arrow keys to navigate between basemaps.
                        Press Enter or Space to select and apply a basemap to the map.
                        Home key jumps to first basemap, End key jumps to last basemap.
                        {activeBasemapId && ` Currently selected: ${loadedBasemaps.find(b => b.id === activeBasemapId)?.title || 'Unknown'}.`}
                    </div>

                    {/* WCAG 4.1.2 - Name, Role, Value - Proper listbox semantics */}
                    <div
                        ref={galleryRef}
                        className={`gallery-container ${displayMode === 'list' ? 'list-mode' : 'grid-mode'}`}
                        role='listbox'
                        aria-label={`Basemap selection gallery - ${displayMode === 'list' ? 'list view' : 'grid view'}`}
                        aria-describedby='basemap-instructions'
                        aria-activedescendant={activeBasemapId ? `basemap-${activeBasemapId}` : undefined}
                    >
                        {loadedBasemaps.map((item, index) => {
                            const isActive = activeBasemapId === item.id
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
                                    <button
                                        ref={el => { itemRefs.current[index] = el }}
                                        id={`basemap-${item.id}`}
                                        className={`basemap-item ${isActive ? 'active' : ''}`}
                                        onClick={() => handleBasemapClick(item, index)}
                                        onKeyDown={(e) => handleKeyDown(e, item, index)}
                                        role='option'
                                        aria-selected={isActive}
                                        aria-label={`${item.title}${isActive ? ', currently selected basemap' : ''}, ${index + 1} of ${loadedBasemaps.length}`}
                                        aria-posinset={index + 1}
                                        aria-setsize={loadedBasemaps.length}
                                        tabIndex={index === 0 || index === focusedIndex ? 0 : -1}
                                    >
                                        {/* WCAG 1.1.1 - Decorative images hidden from screen readers */}
                                        {item.thumbnailUrl ? (
                                            <img
                                                className='basemap-thumbnail'
                                                src={item.thumbnailUrl}
                                                alt=''
                                                aria-hidden='true'
                                                draggable='false'
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
                                    </button>
                                </Tooltip>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

export default Widget