import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from '../locales/en.json'
import de from '../locales/de.json'
import { authApi } from './api'

export const SUPPORTED_LOCALES = ['en', 'de'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const LOCALE_STORAGE_KEY = 'vbscout-locale'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    interpolation: {
      escapeValue: false, // React handles XSS
    },
    detection: {
      // Priority order for language detection
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

/**
 * Apply a locale coming from the server (e.g. on login) to i18next + localStorage
 * WITHOUT writing back to the DB. Used so a user's saved preference follows them
 * across devices without triggering a redundant network round-trip.
 */
export function applyLocale(locale?: string | null): void {
  if (!locale || !SUPPORTED_LOCALES.includes(locale as Locale)) return
  if (i18n.language?.split('-')[0] === locale) return
  void i18n.changeLanguage(locale)
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore storage failures */
  }
}

/**
 * Change the active language across all three persistence layers:
 *  1. i18next (UI updates instantly)
 *  2. localStorage (survives refresh, read before first render)
 *  3. user.locale in the DB (follows the user across devices) — best effort
 */
export async function changeLanguage(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale)
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore storage failures */
  }
  // Sync to the DB only when authenticated; ignore failures (e.g. logged out).
  try {
    const hasToken = !!localStorage.getItem('vbscout-auth')
    if (hasToken) await authApi.patchMe({ locale })
  } catch {
    /* offline / unauthenticated — localStorage still holds the preference */
  }
}

export default i18n
