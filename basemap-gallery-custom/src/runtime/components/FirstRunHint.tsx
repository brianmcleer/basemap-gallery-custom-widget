import { React } from 'jimu-core'
import { Button } from 'jimu-ui'
import { CalciteIcon } from 'calcite-components'
import { useTokens } from '../theme'

interface FirstRunHintProps {
  showFirstRunHint: boolean
  t: (id: string) => string
  onOpenHelp: () => void
  onDismissHint: () => void
}

const FirstRunHint: React.FC<FirstRunHintProps> = ({ showFirstRunHint, t, onOpenHelp, onDismissHint }) => {
  const tokens = useTokens()
  return (
    <React.Fragment>
      {showFirstRunHint && (
        <div role="note" style={{ margin: '0 14px 10px 14px', padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: '10px', background: tokens.infoBg, color: tokens.text, border: `1px solid ${tokens.divider}`, borderLeft: `3px solid ${tokens.primary}`, borderRadius: tokens.radius, fontSize: '12px', lineHeight: 1.5 }}>
          <span style={{ color: tokens.primary, marginTop: '1px' }} aria-hidden="true"><CalciteIcon icon="lightbulb" scale="s" /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: 'block', marginBottom: '2px' }}>{t('firstRunTitle')}</strong>
            {t('firstRunBody')}
            {' '}
            <button type="button" onClick={onOpenHelp} style={{ border: 'none', background: 'transparent', padding: 0, color: tokens.primary, cursor: 'pointer', textDecoration: 'underline', font: 'inherit' }}>{t('firstRunHelpLink')}</button>
          </span>
          <Button size="sm" type="tertiary" icon onClick={onDismissHint} title={t('firstRunDismiss')} aria-label={t('firstRunDismiss')}>
            <CalciteIcon icon="x" scale="s" />
          </Button>
        </div>
      )}
    </React.Fragment>
  )
}

export default FirstRunHint
