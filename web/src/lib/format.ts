// Locale-aware date / time / number formatting built on the native Intl API.
// The active locale is read from i18next so formatting follows the chosen language.
import i18n from './i18n'

type Locale = 'en' | 'de'

export function currentLocale(): Locale {
  const lng = (i18n.language || 'en').split('-')[0]
  return lng === 'de' ? 'de' : 'en'
}

// ── Dates ──────────────────────────────────────────────────────────────────

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    day: 'numeric', month: 'short', year: 'numeric',
  }).format(new Date(date))
  // en: "12 Jun 2026"  |  de: "12. Juni 2026"
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    day: 'numeric', month: 'short',
  }).format(new Date(date))
  // en: "12 Jun"  |  de: "12. Juni"
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(date))
  // en: "12 Jun 2026, 19:00"  |  de: "12. Juni 2026, 19:00"
}

export function formatTimeOnly(date: Date | string): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(date))
  // both: "19:00"  (24h in both locales for this app)
}

export function formatRelative(date: Date | string): string {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' })
  if (diff < 60)      return rtf.format(-diff, 'seconds')
  if (diff < 3600)    return rtf.format(-Math.floor(diff / 60), 'minutes')
  if (diff < 86400)   return rtf.format(-Math.floor(diff / 3600), 'hours')
  if (diff < 2592000) return rtf.format(-Math.floor(diff / 86400), 'days')
  return rtf.format(-Math.floor(diff / 2592000), 'months')
  // en: "2 hours ago"  |  de: "vor 2 Stunden"
}

// ── Numbers ────────────────────────────────────────────────────────────────

export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
  // en: "1,842"  |  de: "1.842"
}

export function formatPercent(n: number, decimals = 0): string {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n / 100)
  // en: "57%"  |  de: "57 %"  (German adds a space before %)
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'currency', currency,
    minimumFractionDigits: 2,
  }).format(amount)
  // en: "€9.00"  |  de: "9,00 €"
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (currentLocale() === 'de') return h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
