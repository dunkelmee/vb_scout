import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { changeLanguage, type Locale } from '../../lib/i18n'
import { cn } from '../ui/cn'

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
]

export function LanguageSelector() {
  const { t, i18n } = useTranslation()
  const active = i18n.language?.split('-')[0]

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        {t('settings.languageLabel')}
      </p>
      <div className="space-y-1">
        {LANGUAGES.map(lang => {
          const isActive = active === lang.code
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => { if (!isActive) void changeLanguage(lang.code) }}
              className={cn(
                'flex items-center gap-3 w-full py-2.5 px-3 rounded-xl transition-colors text-left',
                isActive ? 'bg-surface-high' : 'hover:bg-white/[0.04]',
              )}
            >
              <span
                className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                  isActive ? 'border-orange' : 'border-outline/40',
                )}
              >
                {isActive && <span className="w-2 h-2 rounded-full bg-orange" />}
              </span>
              <span className="text-sm text-on-surface flex-1">{lang.label}</span>
              {isActive && <Check size={14} className="text-orange" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
