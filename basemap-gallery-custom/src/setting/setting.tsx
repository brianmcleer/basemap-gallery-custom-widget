import { React, ImmutableObject, css } from 'jimu-core'
import { type AllWidgetSettingProps } from 'jimu-for-builder'
import { MapWidgetSelector, SettingSection, SettingRow } from 'jimu-ui/advanced/setting-components'
import {
    TextInput,
    Label,
    Switch,
    Button,
    Loading,
    Alert,
    TextArea,
    Tooltip,
    CollapsablePanel,
    Select,
    Option
} from 'jimu-ui'

const { useState, useEffect, useRef } = React

interface SectionState {
    map: boolean
    appearance: boolean
    portalSource: boolean
    browsePortal: boolean
    importExport: boolean
    selectedBasemaps: boolean
}

interface BasemapItem {
    id: string
    title: string
    thumbnailUrl?: string
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

export type IMConfig = ImmutableObject<Config>

const SIZE_OPTIONS: { value: SizeOption, label: string }[] = [
    { value: 'xs', label: 'Extra Small' },
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium (Default)' },
    { value: 'lg', label: 'Large' },
    { value: 'xl', label: 'Extra Large' }
]

const DISPLAY_MODE_OPTIONS: { value: DisplayMode, label: string }[] = [
    { value: 'grid', label: 'Grid (Thumbnails)' },
    { value: 'list', label: 'List (Rows)' }
]

const Setting = (props: AllWidgetSettingProps<IMConfig>) => {
    const [useCustomPortal, setUseCustomPortal] = useState(!!props.config?.portalUrl)
    const [portalItems, setPortalItems] = useState<BasemapItem[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string>(null)
    const [searchText, setSearchText] = useState('')
    const [importXml, setImportXml] = useState('')
    const [importError, setImportError] = useState<string>(null)
    const [importSuccess, setImportSuccess] = useState(false)
    const [exportXml, setExportXml] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Section collapse state
    const [openSections, setOpenSections] = useState<SectionState>({
        map: true,
        appearance: true,
        portalSource: true,
        browsePortal: true,
        importExport: false,
        selectedBasemaps: true
    })

    const toggleSection = (section: keyof SectionState) => {
        setOpenSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }

    // Generate XML from current config
    const generateExportXml = (): string => {
        const basemaps = props.config?.basemaps
            ? (props.config.basemaps as any).asMutable?.() || [...(props.config.basemaps as any)]
            : []

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        xml += '<BasemapGalleryConfig>\n'

        if (props.config?.portalUrl) {
            xml += `  <portalUrl>${escapeXml(props.config.portalUrl)}</portalUrl>\n`
        }

        if (props.config?.defaultBasemapId) {
            xml += `  <defaultBasemapId>${escapeXml(props.config.defaultBasemapId)}</defaultBasemapId>\n`
        }

        if (props.config?.size) {
            xml += `  <size>${escapeXml(props.config.size)}</size>\n`
        }

        if (props.config?.displayMode) {
            xml += `  <displayMode>${escapeXml(props.config.displayMode)}</displayMode>\n`
        }

        if (basemaps.length > 0) {
            xml += '  <basemaps>\n'
            basemaps.forEach((b: BasemapItem) => {
                xml += '    <basemap>\n'
                xml += `      <id>${escapeXml(b.id)}</id>\n`
                xml += `      <title>${escapeXml(b.title)}</title>\n`
                if (b.thumbnailUrl) {
                    xml += `      <thumbnailUrl>${escapeXml(b.thumbnailUrl)}</thumbnailUrl>\n`
                }
                xml += '    </basemap>\n'
            })
            xml += '  </basemaps>\n'
        }

        xml += '</BasemapGalleryConfig>'
        return xml
    }

    const escapeXml = (str: string): string => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
    }

    const unescapeXml = (str: string): string => {
        return str
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&')
    }

    const parseXml = (xmlString: string): { portalUrl?: string, defaultBasemapId?: string, size?: SizeOption, displayMode?: DisplayMode, basemaps: BasemapItem[] } | null => {
        try {
            const parser = new DOMParser()
            const doc = parser.parseFromString(xmlString, 'text/xml')

            const parseError = doc.querySelector('parsererror')
            if (parseError) {
                throw new Error('Invalid XML format')
            }

            const root = doc.querySelector('BasemapGalleryConfig')
            if (!root) {
                throw new Error('Missing BasemapGalleryConfig root element')
            }

            const result: { portalUrl?: string, defaultBasemapId?: string, size?: SizeOption, displayMode?: DisplayMode, basemaps: BasemapItem[] } = {
                basemaps: []
            }

            const portalUrlEl = root.querySelector('portalUrl')
            if (portalUrlEl?.textContent) {
                result.portalUrl = unescapeXml(portalUrlEl.textContent)
            }

            const defaultBasemapIdEl = root.querySelector('defaultBasemapId')
            if (defaultBasemapIdEl?.textContent) {
                result.defaultBasemapId = unescapeXml(defaultBasemapIdEl.textContent)
            }

            const sizeEl = root.querySelector('size')
            if (sizeEl?.textContent) {
                const sizeValue = unescapeXml(sizeEl.textContent) as SizeOption
                if (['xs', 'sm', 'md', 'lg', 'xl'].includes(sizeValue)) {
                    result.size = sizeValue
                }
            }

            const displayModeEl = root.querySelector('displayMode')
            if (displayModeEl?.textContent) {
                const displayModeValue = unescapeXml(displayModeEl.textContent) as DisplayMode
                if (['grid', 'list'].includes(displayModeValue)) {
                    result.displayMode = displayModeValue
                }
            }

            const basemapEls = root.querySelectorAll('basemaps > basemap')
            basemapEls.forEach(basemapEl => {
                const id = basemapEl.querySelector('id')?.textContent
                const title = basemapEl.querySelector('title')?.textContent
                const thumbnailUrl = basemapEl.querySelector('thumbnailUrl')?.textContent

                if (id && title) {
                    result.basemaps.push({
                        id: unescapeXml(id),
                        title: unescapeXml(title),
                        thumbnailUrl: thumbnailUrl ? unescapeXml(thumbnailUrl) : undefined
                    })
                }
            })

            return result
        } catch (err) {
            console.error('XML parse error:', err)
            return null
        }
    }

    const handleExport = () => {
        const xml = generateExportXml()
        setExportXml(xml)
    }

    const handleCopyExport = () => {
        navigator.clipboard.writeText(exportXml)
    }

    const handleDownloadExport = () => {
        const xml = generateExportXml()
        const blob = new Blob([xml], { type: 'application/xml' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'basemap-gallery-config.xml'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    const handleImport = () => {
        setImportError(null)
        setImportSuccess(false)

        if (!importXml.trim()) {
            setImportError('Please enter XML configuration')
            return
        }

        const parsed = parseXml(importXml)
        if (!parsed) {
            setImportError('Failed to parse XML. Check the format and try again.')
            return
        }

        let newConfig = props.config

        if (parsed.portalUrl) {
            newConfig = newConfig.set('portalUrl', parsed.portalUrl)
            setUseCustomPortal(true)
        } else {
            newConfig = newConfig.set('portalUrl', null)
            setUseCustomPortal(false)
        }

        newConfig = newConfig.set('basemaps', parsed.basemaps)
        newConfig = newConfig.set('defaultBasemapId', parsed.defaultBasemapId || (parsed.basemaps.length > 0 ? parsed.basemaps[0].id : null))

        if (parsed.size) {
            newConfig = newConfig.set('size', parsed.size)
        }

        if (parsed.displayMode) {
            newConfig = newConfig.set('displayMode', parsed.displayMode)
        }

        props.onSettingChange({
            id: props.id,
            config: newConfig
        })

        setImportSuccess(true)
        setImportXml('')
        setTimeout(() => setImportSuccess(false), 3000)
    }

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const content = event.target?.result as string
            setImportXml(content)
        }
        reader.onerror = () => {
            setImportError('Failed to read file')
        }
        reader.readAsText(file)

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const getPortalUrl = (): string => {
        const url = props.config?.portalUrl || props.portalUrl || 'https://www.arcgis.com'
        return url.endsWith('/') ? url.slice(0, -1) : url
    }

    const isItemId = (text: string): boolean => {
        return /^[a-f0-9]{32}$/i.test(text.trim())
    }

    const fetchItemById = async (itemId: string): Promise<BasemapItem | null> => {
        const portalUrl = getPortalUrl()
        try {
            const response = await fetch(`${portalUrl}/sharing/rest/content/items/${itemId}?f=json`)
            if (!response.ok) return null

            const item = await response.json()
            if (item.error) return null

            return {
                id: item.id,
                title: item.title,
                thumbnailUrl: item.thumbnail
                    ? `${portalUrl}/sharing/rest/content/items/${item.id}/info/${item.thumbnail}`
                    : null
            }
        } catch {
            return null
        }
    }

    const fetchBasemaps = async () => {
        setIsLoading(true)
        setError(null)

        try {
            const portalUrl = getPortalUrl()

            if (searchText && isItemId(searchText)) {
                const item = await fetchItemById(searchText.trim())
                if (item) {
                    setPortalItems([item])
                } else {
                    setPortalItems([])
                    setError('Item not found with that ID')
                }
                setIsLoading(false)
                return
            }

            const query = searchText
                ? `(title:${searchText} OR ${searchText}) AND (type:"Web Map" OR type:"Vector Tile Service")`
                : '(type:"Web Map" AND tags:basemap) OR (type:"Vector Tile Service" AND typekeywords:basemap)'

            const params = new URLSearchParams({
                q: query,
                num: '20',
                sortField: 'title',
                sortOrder: 'asc',
                f: 'json'
            })

            const response = await fetch(`${portalUrl}/sharing/rest/search?${params}`)

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const data = await response.json()

            if (data.error) {
                throw new Error(data.error.message || 'Portal query failed')
            }

            const items: BasemapItem[] = (data.results || []).map((item: any) => ({
                id: item.id,
                title: item.title,
                thumbnailUrl: item.thumbnail
                    ? `${portalUrl}/sharing/rest/content/items/${item.id}/info/${item.thumbnail}`
                    : null
            }))

            setPortalItems(items)
        } catch (err) {
            setError(`Failed to load items: ${err.message}`)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchBasemaps()
    }, [props.config?.portalUrl, props.portalUrl])

    const onMapWidgetSelected = (useMapWidgetIds: string[]) => {
        props.onSettingChange({
            id: props.id,
            useMapWidgetIds: useMapWidgetIds
        })
    }

    const handlePortalUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        props.onSettingChange({
            id: props.id,
            config: props.config.set('portalUrl', e.target.value || null)
        })
    }

    const handleCustomPortalToggle = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const checked = evt.target.checked
        setUseCustomPortal(checked)
        if (!checked) {
            props.onSettingChange({
                id: props.id,
                config: props.config.set('portalUrl', null)
            })
        }
    }

    const handleSizeChange = (evt: React.ChangeEvent<HTMLSelectElement>) => {
        props.onSettingChange({
            id: props.id,
            config: props.config.set('size', evt.target.value as SizeOption)
        })
    }

    const handleDisplayModeChange = (evt: React.ChangeEvent<HTMLSelectElement>) => {
        props.onSettingChange({
            id: props.id,
            config: props.config.set('displayMode', evt.target.value as DisplayMode)
        })
    }

    const handleAddBasemap = (item: BasemapItem) => {
        const currentBasemaps = props.config?.basemaps
            ? (props.config.basemaps as any).asMutable?.() || [...(props.config.basemaps as any)]
            : []

        if (currentBasemaps.some((b: BasemapItem) => b.id === item.id)) return

        const updatedBasemaps = [...currentBasemaps, item]

        let newConfig = props.config.set('basemaps', updatedBasemaps)

        if (updatedBasemaps.length === 1) {
            newConfig = newConfig.set('defaultBasemapId', item.id)
        }

        props.onSettingChange({
            id: props.id,
            config: newConfig
        })
    }

    const handleRemoveBasemap = (itemId: string) => {
        const currentBasemaps = props.config?.basemaps
            ? (props.config.basemaps as any).asMutable?.() || [...(props.config.basemaps as any)]
            : []
        const updatedBasemaps = currentBasemaps.filter((b: BasemapItem) => b.id !== itemId)

        let newConfig = props.config.set('basemaps', updatedBasemaps)

        if (props.config?.defaultBasemapId === itemId) {
            newConfig = newConfig.set('defaultBasemapId', updatedBasemaps.length > 0 ? updatedBasemaps[0].id : null)
        }

        props.onSettingChange({
            id: props.id,
            config: newConfig
        })
    }

    const handleSetDefault = (itemId: string) => {
        props.onSettingChange({
            id: props.id,
            config: props.config.set('defaultBasemapId', itemId)
        })
    }

    const handleMoveUp = (index: number) => {
        if (index === 0) return

        const currentBasemaps = props.config?.basemaps
            ? (props.config.basemaps as any).asMutable?.() || [...(props.config.basemaps as any)]
            : []

        const newBasemaps = [...currentBasemaps]
        const temp = newBasemaps[index - 1]
        newBasemaps[index - 1] = newBasemaps[index]
        newBasemaps[index] = temp

        props.onSettingChange({
            id: props.id,
            config: props.config.set('basemaps', newBasemaps)
        })
    }

    const handleMoveDown = (index: number) => {
        const currentBasemaps = props.config?.basemaps
            ? (props.config.basemaps as any).asMutable?.() || [...(props.config.basemaps as any)]
            : []

        if (index >= currentBasemaps.length - 1) return

        const newBasemaps = [...currentBasemaps]
        const temp = newBasemaps[index + 1]
        newBasemaps[index + 1] = newBasemaps[index]
        newBasemaps[index] = temp

        props.onSettingChange({
            id: props.id,
            config: props.config.set('basemaps', newBasemaps)
        })
    }

    const handleSearch = () => {
        fetchBasemaps()
    }

    const handleSearchKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            fetchBasemaps()
        }
    }

    const isSelected = (itemId: string): boolean => {
        const currentBasemaps = props.config?.basemaps || []
        return (currentBasemaps as any).some?.((b: BasemapItem) => b.id === itemId) || false
    }

    const selectedBasemaps: BasemapItem[] = props.config?.basemaps
        ? (props.config.basemaps as any).asMutable?.() || [...(props.config.basemaps as any)]
        : []

    const defaultBasemapId = props.config?.defaultBasemapId

    const settingStyles = css`
    .widget-setting {
      height: 100%;
      overflow-y: auto;
    }

    .basemap-list-item {
      display: flex;
      flex-direction: column;
      padding: 8px;
      margin-bottom: 8px;
      background-color: var(--sys-color-surface-2);
      border: 1px solid var(--sys-color-divider-primary);
      border-radius: 4px;
    }

    .basemap-list-item:hover {
      background-color: var(--sys-color-surface-3);
    }

    .basemap-list-item-top {
      display: flex;
      align-items: center;
    }

    .sort-buttons {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-right: 8px;
    }

    .sort-btn {
      padding: 2px 6px;
      min-width: 24px;
      height: 20px;
      font-size: 10px;
      line-height: 1;
    }

    .default-btn {
      padding: 4px;
      min-width: 32px;
      margin-right: 8px;
      font-size: 18px;
    }

    .default-btn.is-default {
      color: var(--sys-color-warning-main);
    }

    .basemap-thumbnail {
      width: 56px;
      height: 56px;
      object-fit: cover;
      border-radius: 4px;
      flex-shrink: 0;
      border: 1px solid var(--sys-color-divider-secondary);
    }

    .basemap-thumbnail-placeholder {
      width: 56px;
      height: 56px;
      border-radius: 4px;
      flex-shrink: 0;
      background-color: var(--sys-color-surface-3);
      border: 1px solid var(--sys-color-divider-secondary);
    }

    .basemap-info {
      flex: 1;
      padding: 8px 0 0 0;
    }

    .basemap-title {
      font-size: 13px;
      font-weight: 500;
      color: var(--sys-color-text-primary);
      margin-bottom: 2px;
      word-wrap: break-word;
    }

    .basemap-id {
      font-size: 11px;
      color: var(--sys-color-text-tertiary);
      word-wrap: break-word;
    }

    .default-badge {
      font-size: 10px;
      color: var(--sys-color-warning-main);
      font-weight: 500;
      margin-left: 4px;
    }

    .remove-btn {
      margin-left: auto;
      flex-shrink: 0;
    }

    .browse-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--sys-color-divider-primary);
      border-radius: 4px;
      background-color: var(--sys-color-surface-1);
    }

    .browse-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid var(--sys-color-divider-secondary);
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .browse-item:last-child {
      border-bottom: none;
    }

    .browse-item:hover:not(.selected) {
      background-color: var(--sys-color-surface-2);
    }

    .browse-item.selected {
      background-color: var(--sys-color-primary-light);
    }

    .browse-thumbnail {
      width: 40px;
      height: 40px;
      object-fit: cover;
      border-radius: 4px;
      margin-right: 10px;
      flex-shrink: 0;
      border: 1px solid var(--sys-color-divider-secondary);
    }

    .browse-thumbnail-placeholder {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      margin-right: 10px;
      flex-shrink: 0;
      background-color: var(--sys-color-surface-3);
      border: 1px solid var(--sys-color-divider-secondary);
    }

    .browse-title {
      flex: 1;
      font-size: 13px;
      color: var(--sys-color-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .added-indicator {
      font-size: 12px;
      color: var(--sys-color-success-main);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .search-container {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .search-input {
      flex: 1;
      min-width: 0;
    }

    .search-btn {
      flex-shrink: 0;
      white-space: nowrap;
    }

    .help-text {
      font-size: 12px;
      color: var(--sys-color-text-secondary);
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .empty-message {
      padding: 24px;
      text-align: center;
      color: var(--sys-color-text-tertiary);
      font-size: 13px;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 24px;
    }

    .import-export-section {
      margin-top: 8px;
    }

    .xml-textarea {
      width: 100%;
      min-height: 120px;
      font-family: monospace;
      font-size: 11px;
      resize: vertical;
    }

    .button-group {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .file-input-hidden {
      display: none;
    }

    .import-export-help {
      font-size: 11px;
      color: var(--sys-color-text-tertiary);
      margin-top: 4px;
      line-height: 1.4;
    }

    .collapsible-section {
      margin-bottom: 0;
    }

    .collapsible-section .jimu-widget-setting--section-header {
      cursor: pointer;
      user-select: none;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      padding: 8px 0;
    }

    .section-header:hover {
      opacity: 0.8;
    }

    .section-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--sys-color-text-primary);
    }

    .section-toggle {
      font-size: 12px;
      color: var(--sys-color-text-secondary);
      transition: transform 0.2s ease;
    }

    .section-toggle.collapsed {
      transform: rotate(-90deg);
    }

    .section-content {
      transition: max-height 0.3s ease, opacity 0.2s ease;
    }

    .section-content.collapsed {
      max-height: 0;
      opacity: 0;
      padding: 0;
      overflow: hidden;
    }

    .section-content.expanded {
      max-height: none;
      opacity: 1;
      overflow: visible;
    }

    .basemap-list-scroll {
      max-height: 500px;
      overflow-y: auto;
      border: 1px solid var(--sys-color-divider-primary);
      border-radius: 4px;
      padding: 4px;
    }
  `

    return (
        <div className='widget-setting' css={settingStyles}>
            <SettingSection className='collapsible-section'>
                <div
                    className='section-header'
                    onClick={() => toggleSection('map')}
                    role='button'
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && toggleSection('map')}
                    aria-expanded={openSections.map}
                    aria-controls='section-map'
                >
                    <span className='section-title'>Map</span>
                    <span className={`section-toggle ${!openSections.map ? 'collapsed' : ''}`}>▼</span>
                </div>
                <div
                    id='section-map'
                    className={`section-content ${openSections.map ? 'expanded' : 'collapsed'}`}
                >
                    <SettingRow>
                        <MapWidgetSelector
                            useMapWidgetIds={props.useMapWidgetIds}
                            onSelect={onMapWidgetSelected}
                        />
                    </SettingRow>
                </div>
            </SettingSection>

            <SettingSection className='collapsible-section'>
                <div
                    className='section-header'
                    onClick={() => toggleSection('appearance')}
                    role='button'
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && toggleSection('appearance')}
                    aria-expanded={openSections.appearance}
                    aria-controls='section-appearance'
                >
                    <span className='section-title'>Appearance</span>
                    <span className={`section-toggle ${!openSections.appearance ? 'collapsed' : ''}`}>▼</span>
                </div>
                <div
                    id='section-appearance'
                    className={`section-content ${openSections.appearance ? 'expanded' : 'collapsed'}`}
                >
                    <SettingRow label='Display Mode' flow='no-wrap'>
                        <Select
                            value={props.config?.displayMode || 'grid'}
                            onChange={handleDisplayModeChange}
                            size='sm'
                            style={{ width: '150px' }}
                        >
                            {DISPLAY_MODE_OPTIONS.map(opt => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
                    </SettingRow>

                    <SettingRow label='Display Size' flow='no-wrap'>
                        <Select
                            value={props.config?.size || 'md'}
                            onChange={handleSizeChange}
                            size='sm'
                            style={{ width: '150px' }}
                        >
                            {SIZE_OPTIONS.map(opt => (
                                <Option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </Option>
                            ))}
                        </Select>
                    </SettingRow>
                </div>
            </SettingSection>

            <SettingSection className='collapsible-section'>
                <div
                    className='section-header'
                    onClick={() => toggleSection('portalSource')}
                    role='button'
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && toggleSection('portalSource')}
                    aria-expanded={openSections.portalSource}
                    aria-controls='section-portal-source'
                >
                    <span className='section-title'>Portal Source</span>
                    <span className={`section-toggle ${!openSections.portalSource ? 'collapsed' : ''}`}>▼</span>
                </div>
                <div
                    id='section-portal-source'
                    className={`section-content ${openSections.portalSource ? 'expanded' : 'collapsed'}`}
                >
                    <SettingRow label='Use custom portal' flow='no-wrap'>
                        <Switch
                            checked={useCustomPortal}
                            onChange={handleCustomPortalToggle}
                        />
                    </SettingRow>

                    {useCustomPortal && (
                        <SettingRow flow='wrap'>
                            <Label className='w-100'>
                                Portal URL
                                <TextInput
                                    className='w-100 mt-1'
                                    placeholder='https://your-portal.com/portal'
                                    value={props.config?.portalUrl || ''}
                                    onChange={handlePortalUrlChange}
                                    onAcceptValue={fetchBasemaps}
                                />
                            </Label>
                        </SettingRow>
                    )}
                </div>
            </SettingSection>

            <SettingSection className='collapsible-section'>
                <div
                    className='section-header'
                    onClick={() => toggleSection('browsePortal')}
                    role='button'
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && toggleSection('browsePortal')}
                    aria-expanded={openSections.browsePortal}
                    aria-controls='section-browse-portal'
                >
                    <span className='section-title'>Browse Portal Items</span>
                    <span className={`section-toggle ${!openSections.browsePortal ? 'collapsed' : ''}`}>▼</span>
                </div>
                <div
                    id='section-browse-portal'
                    className={`section-content ${openSections.browsePortal ? 'expanded' : 'collapsed'}`}
                >
                    <div className='search-container'>
                        <TextInput
                            className='search-input'
                            placeholder='Search by title or item ID...'
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onKeyPress={handleSearchKeyPress}
                        />
                        <Button
                            className='search-btn'
                            type='primary'
                            onClick={handleSearch}
                            disabled={isLoading}
                        >
                            Search
                        </Button>
                    </div>

                    {error && (
                        <Alert type='error' text={error} className='mb-3' />
                    )}

                    {isLoading ? (
                        <div className='loading-container'>
                            <Loading />
                        </div>
                    ) : (
                        <div className='browse-list'>
                            {portalItems.length === 0 ? (
                                <div className='empty-message'>
                                    No items found. Try a different search term.
                                </div>
                            ) : (
                                portalItems.map(item => {
                                    const selected = isSelected(item.id)
                                    return (
                                        <div
                                            key={item.id}
                                            className={`browse-item ${selected ? 'selected' : ''}`}
                                            onClick={() => !selected && handleAddBasemap(item)}
                                            role='button'
                                            tabIndex={0}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && !selected) {
                                                    handleAddBasemap(item)
                                                }
                                            }}
                                        >
                                            {item.thumbnailUrl ? (
                                                <img
                                                    src={item.thumbnailUrl}
                                                    alt={item.title}
                                                    className='browse-thumbnail'
                                                />
                                            ) : (
                                                <div className='browse-thumbnail-placeholder' />
                                            )}
                                            <div className='browse-title' title={item.title}>
                                                {item.title}
                                            </div>
                                            {selected ? (
                                                <span className='added-indicator'>✓ Added</span>
                                            ) : (
                                                <Button type='tertiary' size='sm'>Add</Button>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    )}
                </div>
            </SettingSection>

            <SettingSection className='collapsible-section'>
                <div
                    className='section-header'
                    onClick={() => toggleSection('importExport')}
                    role='button'
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && toggleSection('importExport')}
                    aria-expanded={openSections.importExport}
                    aria-controls='section-import-export'
                >
                    <span className='section-title'>Import / Export Configuration</span>
                    <span className={`section-toggle ${!openSections.importExport ? 'collapsed' : ''}`}>▼</span>
                </div>
                <div
                    id='section-import-export'
                    className={`section-content ${openSections.importExport ? 'expanded' : 'collapsed'}`}
                >
                    <CollapsablePanel
                        label='Export Configuration'
                        type='default'
                        defaultIsOpen={false}
                        className='mb-3'
                    >
                        <div className='import-export-section'>
                            <div className='help-text'>
                                Export your basemap configuration to XML for backup or sharing.
                            </div>
                            <div className='button-group'>
                                <Button type='primary' onClick={handleExport}>
                                    Generate XML
                                </Button>
                                <Button type='default' onClick={handleDownloadExport}>
                                    Download File
                                </Button>
                            </div>
                            {exportXml && (
                                <>
                                    <TextArea
                                        className='xml-textarea mt-2'
                                        value={exportXml}
                                        readOnly
                                    />
                                    <div className='button-group'>
                                        <Button type='tertiary' size='sm' onClick={handleCopyExport}>
                                            Copy to Clipboard
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </CollapsablePanel>

                    <CollapsablePanel
                        label='Import Configuration'
                        type='default'
                        defaultIsOpen={false}
                    >
                        <div className='import-export-section'>
                            <div className='help-text'>
                                Import basemap configuration from XML. This will replace your current basemap selections.
                            </div>

                            <input
                                ref={fileInputRef}
                                type='file'
                                accept='.xml,application/xml,text/xml'
                                onChange={handleFileImport}
                                className='file-input-hidden'
                            />

                            <div className='button-group mb-2'>
                                <Button
                                    type='default'
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    Load from File
                                </Button>
                            </div>

                            <Label className='w-100'>
                                Or paste XML:
                                <TextArea
                                    className='xml-textarea mt-1'
                                    value={importXml}
                                    onChange={(e) => setImportXml(e.target.value)}
                                    placeholder='<?xml version="1.0" encoding="UTF-8"?>
<BasemapGalleryConfig>
  <portalUrl>https://your-portal.com/portal</portalUrl>
  <defaultBasemapId>abc123...</defaultBasemapId>
  <size>md</size>
  <basemaps>
    <basemap>
      <id>item-id-here</id>
      <title>Basemap Title</title>
    </basemap>
  </basemaps>
</BasemapGalleryConfig>'
                                />
                            </Label>

                            {importError && (
                                <Alert type='error' text={importError} className='mt-2' />
                            )}

                            {importSuccess && (
                                <Alert type='success' text='Configuration imported successfully!' className='mt-2' />
                            )}

                            <div className='button-group'>
                                <Button
                                    type='primary'
                                    onClick={handleImport}
                                    disabled={!importXml.trim()}
                                >
                                    Import Configuration
                                </Button>
                                {importXml && (
                                    <Button
                                        type='tertiary'
                                        onClick={() => {
                                            setImportXml('')
                                            setImportError(null)
                                        }}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>

                            <div className='import-export-help'>
                                Note: Importing will replace all current basemap selections but will not change the selected map widget.
                            </div>
                        </div>
                    </CollapsablePanel>
                </div>
            </SettingSection>

            <SettingSection className='collapsible-section'>
                <div
                    className='section-header'
                    onClick={() => toggleSection('selectedBasemaps')}
                    role='button'
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && toggleSection('selectedBasemaps')}
                    aria-expanded={openSections.selectedBasemaps}
                    aria-controls='section-selected-basemaps'
                >
                    <span className='section-title'>Selected Basemaps</span>
                    <span className={`section-toggle ${!openSections.selectedBasemaps ? 'collapsed' : ''}`}>▼</span>
                </div>
                <div
                    id='section-selected-basemaps'
                    className={`section-content ${openSections.selectedBasemaps ? 'expanded' : 'collapsed'}`}
                >
                    <div className='help-text'>
                        Click ★ to set the default basemap shown when the app loads. Use arrows to reorder.
                    </div>

                    {selectedBasemaps.length > 0 ? (
                        <div className='basemap-list-scroll'>
                            {selectedBasemaps.map((item: BasemapItem, index: number) => {
                                const isDefault = defaultBasemapId === item.id
                                return (
                                    <div key={item.id} className='basemap-list-item'>
                                        <div className='basemap-list-item-top'>
                                            <div className='sort-buttons'>
                                                <Button
                                                    className='sort-btn'
                                                    type='tertiary'
                                                    onClick={() => handleMoveUp(index)}
                                                    disabled={index === 0}
                                                    title='Move up'
                                                    aria-label='Move up'
                                                >
                                                    ▲
                                                </Button>
                                                <Button
                                                    className='sort-btn'
                                                    type='tertiary'
                                                    onClick={() => handleMoveDown(index)}
                                                    disabled={index === selectedBasemaps.length - 1}
                                                    title='Move down'
                                                    aria-label='Move down'
                                                >
                                                    ▼
                                                </Button>
                                            </div>

                                            <Button
                                                className={`default-btn ${isDefault ? 'is-default' : ''}`}
                                                type='tertiary'
                                                onClick={() => handleSetDefault(item.id)}
                                                title={isDefault ? 'Default basemap' : 'Set as default'}
                                                aria-label={isDefault ? 'Default basemap' : 'Set as default'}
                                            >
                                                {isDefault ? '★' : '☆'}
                                            </Button>

                                            {item.thumbnailUrl ? (
                                                <img
                                                    src={item.thumbnailUrl}
                                                    alt={item.title}
                                                    className='basemap-thumbnail'
                                                />
                                            ) : (
                                                <div className='basemap-thumbnail-placeholder' />
                                            )}

                                            <Button
                                                className='remove-btn'
                                                type='tertiary'
                                                onClick={() => handleRemoveBasemap(item.id)}
                                                title='Remove basemap'
                                                aria-label='Remove basemap'
                                            >
                                                ✕
                                            </Button>
                                        </div>

                                        <div className='basemap-info'>
                                            <div className='basemap-title'>
                                                {item.title}
                                                {isDefault && <span className='default-badge'>(Default)</span>}
                                            </div>
                                            <div className='basemap-id'>{item.id}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <Alert
                            type='info'
                            text='No basemaps selected. Use the Browse Portal Items section above to add basemaps.'
                        />
                    )}
                </div>
            </SettingSection>
        </div>
    )
}

export default Setting