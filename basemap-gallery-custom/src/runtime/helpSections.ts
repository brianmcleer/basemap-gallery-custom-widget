import type { HelpSection } from './components/HelpPopup'

/** Values come from the same conditions that show the runtime controls and messages. */
export interface HelpFeatures {
  mapConnected: boolean
  galleryAvailable: boolean
  listView: boolean
  search: boolean
  favorites: boolean
  defaultBasemap: boolean
  activeIndicator: boolean
  loading: boolean
  empty: boolean
  loadError: boolean
  partialFailure: boolean
  missingThumbnail: boolean
}

type T = (id: string, values?: Record<string, string>) => string

export function buildHelpSections (t: T, f: HelpFeatures): HelpSection[] {
  const when = (on: boolean, ...ids: string[]): string[] => (on ? ids.map((id: string) => t(id)) : [])
  const start = !f.mapConnected
    ? ['helpStartNoMap1', 'helpStartNoMap2', 'helpStartNoMap3']
    : f.loading
      ? ['helpStartLoading1', 'helpStartLoading2', 'helpStartLoading3']
      : f.empty
        ? ['helpStartEmpty1', 'helpStartEmpty2', 'helpStartEmpty3']
        : f.loadError || !f.galleryAvailable
          ? ['helpStartError1', 'helpStartError2', 'helpStartError3']
          : [f.listView ? 'helpStartList' : 'helpStartGrid', 'helpStartChoose', 'helpStartWait']

  return [
    { key: 'start', icon: 'play', title: t('helpStartTitle'), ordered: true, body: start.map(id => t(id)) },
    ...(f.galleryAvailable ? [{
      key: 'use', icon: 'map', title: t('helpUseTitle'), body: [
        t('helpUseChoose'),
        ...(f.activeIndicator ? [t('helpUseIndicator', { activeLabel: t('activeBasemapLabel') }), t('helpUseReapply')] : []),
        ...when(f.defaultBasemap, 'helpUseDefault'),
        t('helpUseOther')
      ]
    }] : []),
    ...(f.favorites ? [{
      key: 'favorites', icon: 'star', title: t('helpFavoritesTitle'), body: [
        t('helpFavoritesAdd', { addLabel: t('favoriteAdd') }),
        t('helpFavoritesRemove', { removeLabel: t('favoriteRemove') }),
        t('helpFavoritesMap')
      ]
    }] : []),
    ...(f.search ? [{
      key: 'organize', icon: 'search', title: t('helpOrganizeTitle'), body: [
        t('helpOrganizeFilter', { filterLabel: t('filterPlaceholder') }),
        t('helpOrganizeNames'), t('helpOrganizeClear')
      ]
    }] : []),
    ...(f.galleryAvailable ? [{
      key: 'keyboard', icon: 'keyboard', title: t('helpKeyboardTitle'), body: [
        t('helpKeyboardTab'), t(f.listView ? 'helpKeyboardList' : 'helpKeyboardGrid'),
        t('helpKeyboardChoose'), t('helpKeyboardEnds'),
        ...when(f.favorites, 'helpKeyboardFavorite')
      ]
    }] : []),
    { key: 'keep', icon: 'folder', title: t('helpKeepTitle'), body: [
      ...when(f.favorites, 'helpKeepFavorites', 'helpKeepClear', 'helpKeepPrivate'),
      t('helpKeepHint')
    ] },
    { key: 'trouble', icon: 'exclamation-mark-triangle', title: t('helpTroubleTitle'), body: [
      ...when(!f.mapConnected, 'helpTroubleNoMap'),
      ...when(f.loading, 'helpTroubleLoading'),
      ...when(f.empty, 'helpTroubleEmpty'),
      ...when(f.loadError, 'helpTroubleLoadError'),
      ...when(f.partialFailure, 'helpTroublePartial'),
      ...(f.search ? [t('helpTroubleSearch', { filterLabel: t('filterPlaceholder') })] : []),
      ...when(f.missingThumbnail, 'helpTroubleThumbnail'),
      ...when(f.galleryAvailable, 'helpTroubleMap'),
      ...when(f.favorites, 'helpTroubleFavorites'),
      t('helpTroubleContact')
    ] },
    { key: 'tips', icon: 'lightbulb', title: t('helpTipsTitle'), body: [
      t('helpTipsHelp', { helpLabel: t('helpTitle') }),
      t('helpTipsClose', { closeLabel: t('close') }),
      ...when(f.favorites, 'helpTipsOrder')
    ] }
  ]
}
