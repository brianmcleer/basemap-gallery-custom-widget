/** Keep the guide hint separate from the existing favorites storage key. */
export function helpHintKey (widgetId: string): string {
  return `basemapGalleryCustom.helpHintDismissed.${widgetId}`
}

export function isHelpHintDismissed (widgetId: string): boolean {
  try {
    return window.localStorage.getItem(helpHintKey(widgetId)) === '1'
  } catch {
    // Blocked storage must never stop the widget from opening.
    return false
  }
}

export function dismissHelpHint (widgetId: string): void {
  try {
    window.localStorage.setItem(helpHintKey(widgetId), '1')
  } catch {
    // The caller still dismisses the hint for the current open widget.
  }
}
