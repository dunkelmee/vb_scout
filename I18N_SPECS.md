# Rallytics — Internationalisation (i18n) Specification

---

## Overview

Rallytics supports two languages at launch: **English** (default fallback) and
**German**. The displayed language is determined in this priority order:

1. User's saved language preference (stored in `localStorage` + `users.locale` DB column)
2. Device/browser language (auto-detected on first launch)
3. English (fallback if no match found)

The i18n system covers:
- All UI strings (labels, buttons, headings, error messages, empty states)
- Date, time, and number formatting (locale-aware)
- Email templates (sent in user's preferred language)
- Analysis microservice insight cards (generated in user's preferred language)
- Onboarding copy

It does **not** translate user-generated content: team names, player names,
opponent names, training session notes, or any free-text fields entered by users.

---

## 1. Technology stack

### 1.1 Frontend library

```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

| Package | Purpose |
|---|---|
| `i18next` | Core translation engine |
| `react-i18next` | React hooks and components (`useTranslation`, `Trans`) |
| `i18next-browser-languagedetector` | Auto-detects device language on first launch |

### 1.2 Storage

Translations are **static JSON files bundled with the frontend** — not stored in
the database. This eliminates network latency on render.

```
web/src/locales/
  en.json        English (fallback)
  de.json        German
```

### 1.3 User preference persistence

| Location | When used |
|---|---|
| `localStorage` key `rallytics_locale` | Loaded before first render — no flash of wrong language |
| `users.locale` DB column | Synced on change — follows user across devices |
| API header `Accept-Language` | Used by Express for email generation |

---

## 2. Database addition

```prisma
// Add to User model
locale String @default("en")  // "en" | "de"
```

API endpoint to update preference:

```
PATCH /api/auth/me
Body: { locale: "de" }
```

This endpoint already exists for profile updates — just add `locale` as an
accepted field.

---

## 3. Frontend setup

### 3.1 i18n configuration (`web/src/lib/i18n.ts`)

```typescript
import i18n from 'i18next'
import { initReactI18next }    from 'react-i18next'
import LanguageDetector        from 'i18next-browser-languagedetector'
import en from '../locales/en.json'
import de from '../locales/de.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng:  'en',
    supportedLngs: ['en', 'de'],
    interpolation: {
      escapeValue: false,   // React handles XSS
    },
    detection: {
      // Priority order for language detection
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'rallytics_locale',
      cacheUserLanguage:  true,
    },
  })

export default i18n
```

Import in `web/src/main.tsx` before the app renders:

```typescript
import './lib/i18n'  // must be first import
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
```

### 3.2 Using translations in components

```typescript
import { useTranslation } from 'react-i18next'

function GamesPage() {
  const { t } = useTranslation()
  return (
    <div>
      <span>{t('nav.games')}</span>           {/* "Games" / "Spiele" */}
      <h1>{t('games.title')}</h1>             {/* "Games" / "Spiele" */}
      <p>{t('games.upcoming')}</p>            {/* "Upcoming" / "Anstehend" */}
    </div>
  )
}
```

For strings with variables:

```typescript
// en.json: "matches_one": "{{count}} match"
// en.json: "matches_other": "{{count}} matches"
// de.json: "matches_one": "{{count}} Spiel"
// de.json: "matches_other": "{{count}} Spiele"

t('matches', { count: 3 })  // → "3 matches" / "3 Spiele"
t('matches', { count: 1 })  // → "1 match" / "1 Spiel"
```

For rich text with HTML (use the `Trans` component):

```typescript
import { Trans } from 'react-i18next'

// en.json: "trialEnding": "You have <strong>{{count}} match</strong> left"
<Trans i18nKey="trialEnding" values={{ count: 1 }} />
```

### 3.3 Changing language programmatically

```typescript
import i18n from '../lib/i18n'
import { useAuthStore } from '../store/authStore'

async function changeLanguage(locale: 'en' | 'de') {
  // 1. Update i18next immediately (UI updates instantly)
  await i18n.changeLanguage(locale)

  // 2. Persist to localStorage (survives refresh)
  localStorage.setItem('rallytics_locale', locale)

  // 3. Sync to DB (follows user across devices)
  await fetch('/api/auth/me', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ locale }),
  })
}
```

---

## 4. Locale-aware formatting

Use the browser's native `Intl` API — no extra library needed.

### 4.1 Formatting utility (`web/src/lib/format.ts`)

```typescript
import i18n from './i18n'

type Locale = 'en' | 'de'

function locale(): Locale {
  return (i18n.language as Locale) || 'en'
}

// ── Dates ──────────────────────────────────────────────────────────────────

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(new Date(date))
  // en: "12 Jun 2026"  |  de: "12. Juni 2026"
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric', month: 'short'
  }).format(new Date(date))
  // en: "12 Jun"  |  de: "12. Juni"
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(date))
  // en: "12 Jun 2026, 19:00"  |  de: "12. Juni 2026, 19:00"
}

export function formatTimeOnly(date: Date | string): string {
  return new Intl.DateTimeFormat(locale(), {
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(date))
  // both: "19:00"  (24h in both locales for this app)
}

export function formatRelative(date: Date | string): string {
  const diff    = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  const rtf     = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  if (diff < 60)         return rtf.format(-diff, 'seconds')
  if (diff < 3600)       return rtf.format(-Math.floor(diff / 60), 'minutes')
  if (diff < 86400)      return rtf.format(-Math.floor(diff / 3600), 'hours')
  if (diff < 2592000)    return rtf.format(-Math.floor(diff / 86400), 'days')
  return rtf.format(-Math.floor(diff / 2592000), 'months')
  // en: "2 hours ago"  |  de: "vor 2 Stunden"
}

// ── Numbers ────────────────────────────────────────────────────────────────

export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat(locale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
  // en: "1,842"  |  de: "1.842"
  // en: "1.09"   |  de: "1,09"
}

export function formatPercent(n: number, decimals = 0): string {
  return new Intl.NumberFormat(locale(), {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n / 100)
  // en: "57%"  |  de: "57 %"  (note: German adds a space before %)
}

export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(locale(), {
    style: 'currency', currency,
    minimumFractionDigits: 2,
  }).format(amount)
  // en: "€9.00"  |  de: "9,00 €"
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (locale() === 'de') return h > 0 ? `${h} Std. ${m} Min.` : `${m} Min.`
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
```

Replace all hardcoded date and number formatting in existing components
with calls to these utilities.

---

## 5. Translation file structure

### 5.1 Naming conventions

- Keys are in English, `camelCase`, nested by feature/page
- Keep nesting to a maximum of 3 levels deep
- Pluralisation uses `_one` / `_other` suffixes (i18next convention)
- Variables use `{{variableName}}` syntax

### 5.2 `en.json` (full structure)

```json
{
  "common": {
    "save":          "Save",
    "cancel":        "Cancel",
    "delete":        "Delete",
    "edit":          "Edit",
    "confirm":       "Confirm",
    "skip":          "Skip",
    "back":          "Back",
    "next":          "Next",
    "done":          "Done",
    "loading":       "Loading…",
    "error":         "Something went wrong",
    "retry":         "Try again",
    "search":        "Search",
    "filter":        "Filter",
    "all":           "All",
    "none":          "None",
    "yes":           "Yes",
    "no":            "No",
    "optional":      "Optional",
    "required":      "Required",
    "comingSoon":    "Coming soon",
    "copiedToClipboard": "Copied to clipboard"
  },

  "nav": {
    "home":          "Home",
    "games":         "Games",
    "trainings":     "Trainings",
    "players":       "Players",
    "settings":      "Settings"
  },

  "auth": {
    "login": {
      "title":           "Welcome back",
      "subtitle":        "Sign in to your team account",
      "emailLabel":      "Email",
      "emailPlaceholder":"coach@volleyclub.de",
      "passwordLabel":   "Password",
      "forgotPassword":  "Forgot password?",
      "signIn":          "Sign in",
      "googleButton":    "Continue with Google",
      "noAccount":       "No account yet?",
      "createOne":       "Create one →"
    },
    "register": {
      "title":           "Create account",
      "subtitle":        "You'll be the team manager",
      "inviteCode":      "Invitation code",
      "inviteCodePlaceholder": "VB3X · 9KQM",
      "inviteValid":     "Joining {{teamName}} as {{role}} ✓",
      "inviteInvalid":   "This code is invalid or has expired",
      "inviteWrongEmail":"This invitation was sent to a different email address",
      "role":            "Role",
      "teamName":        "Team name",
      "firstName":       "First name",
      "lastName":        "Last name",
      "password":        "Password",
      "passwordHint":    "Min. 8 characters",
      "terms":           "I agree to the {{terms}} and {{privacy}}",
      "termsLink":       "Terms of Service",
      "privacyLink":     "Privacy Policy",
      "createButton":    "Create team account",
      "googleButton":    "Sign up with Google",
      "alreadyAccount":  "Already have an account?",
      "signIn":          "Sign in →"
    },
    "totp": {
      "setupTitle":      "Set up two-factor authentication",
      "setupSubtitle":   "Scan this QR code with your authenticator app",
      "verifyTitle":     "Enter your authentication code",
      "verifySubtitle":  "Open your authenticator app and enter the 6-digit code",
      "codePlaceholder": "000 000",
      "verify":          "Verify",
      "backupTitle":     "Save your backup codes",
      "backupSubtitle":  "Store these somewhere safe. Each can only be used once.",
      "backupSaved":     "I've saved my backup codes",
      "invalidCode":     "Invalid code. Please try again.",
      "lockedOut":       "Too many failed attempts. Try again in {{minutes}} minutes."
    }
  },

  "onboarding": {
    "stepTeam":        "Team confirmed",
    "stepPlayers":     "Add first players",
    "stepSeason":      "Create first season",
    "stepDone":        "All set",
    "welcomeTitle":    "Welcome to {{teamName}}, {{firstName}}!",
    "welcomeSubtitle": "You're set up as {{role}}. Complete a few quick steps to get started.",
    "addPlayers":      "Add first players",
    "skipSetup":       "Skip setup, go to dashboard",
    "goToDashboard":   "Go to dashboard",
    "roleManager":     "Head Coach / Team Manager",
    "rolePlayer":      "Player"
  },

  "dashboard": {
    "greeting":            "Hi, {{firstName}} 👋",
    "seasonSnapshot":      "Season snapshot",
    "seasonPerformance":   "Season performance",
    "lastMatch":           "Last match · vs {{opponent}}",
    "trainingFocus":       "Training focus",
    "seasonResults":       "Season results",
    "upcoming":            "Upcoming",
    "record":              "Record",
    "pointsRatio":         "Points ratio",
    "sideoutPct":          "Sideout %",
    "breakPct":            "Break %",
    "targetMet":           "target ≥{{value}}% ✓",
    "targetNotMet":        "target ≥{{value}}%",
    "sideout":             "Sideout",
    "breakPoint":          "Break pt",
    "serveErr":            "Serve err",
    "trendFullView":       "Full view",
    "weakestRotation":     "Weakest rotation: {{rotation}} ({{pct}}%)",
    "viewDetails":         "View details →",
    "noSeasonYet":         "Create your first season to get started",
    "noGamesYet":          "No games this season yet",
    "winRecord":           "{{wins}}–{{losses}}"
  },

  "games": {
    "title":           "Games",
    "eyebrow":         "Match schedule",
    "upcoming":        "Upcoming",
    "pastResults":     "Past results",
    "all":             "All",
    "playing":         "Playing",
    "officiating":     "Officiating",
    "sets":            "Sets",
    "wonBadge":        "W",
    "lostBadge":       "L",
    "liveBadge":       "Live",
    "officBadge":      "Officiating",
    "actionLog":       "Log",
    "actionStats":     "Stats",
    "actionEdit":      "Edit",
    "deleteConfirm":   "Delete this game? This cannot be undone.",
    "empty":           "No games in this season yet",
    "emptyNoSeason":   "Create a season first to start adding games",
    "setLineup":       "Set lineup"
  },

  "gameWizard": {
    "stepDetails":     "Match details",
    "stepPlayers":     "Player selection",
    "stepLineup":      "Starting lineup",
    "matchType":       "Match type",
    "playing":         "Playing",
    "officiating":     "Officiating",
    "opponent":        "Opponent",
    "opponentShort":   "Opponent initials",
    "season":          "Season",
    "dateTime":        "Date & time",
    "location":        "Location",
    "firstServe":      "Who serves first?",
    "us":              "Us",
    "them":            "Them",
    "playersSelected": "{{count}} players selected",
    "minPlayers":      "Minimum 6 players required",
    "selectAll":       "Select all",
    "clearAll":        "Clear all",
    "confirmLineup":   "Confirm",
    "confirmAndLog":   "Confirm & Log",
    "homeTeam":        "Home team",
    "guestTeam":       "Guest team",
    "ref1":            "1st Referee",
    "ref2":            "2nd Referee",
    "scorer1":         "1st Scorer",
    "scorer2":         "2nd Scorer"
  },

  "liveLog": {
    "set":             "Set {{number}}",
    "scoreUs":         "{{score}}",
    "tabLog":          "Log",
    "tabStats":        "Stats",
    "tabTimeline":     "Timeline",
    "tabTactics":      "Tactics",
    "ourTeam":         "{{name}}",
    "undoLastPoint":   "Undo last point",
    "actionLineup":    "Lineup",
    "actionSub":       "Sub",
    "actionTimeout":   "Timeout",
    "actionEndSet":    "End set",
    "subsUsed":        "{{used}}/{{max}}",
    "rotation":        "Rotated",
    "endSetConfirm":   "End Set {{number}}? Score: {{us}} – {{them}}",
    "endMatchConfirm": "End match?",
    "subTitle":        "Substitution",
    "subPlayerOff":    "Player off",
    "subPlayerOn":     "Player on",
    "liberoSwap":      "Libero swap",
    "timeoutTitle":    "Timeout",
    "timeoutUs":       "Called by us",
    "timeoutThem":     "Called by them",
    "autoFallback":    "Auto-saved as own point"
  },

  "stats": {
    "timeoutUrgency":  "Timeout urgency",
    "stable":          "Stable",
    "watch":           "Watch",
    "considerTimeout": "Consider timeout",
    "callTimeoutNow":  "Call timeout now",
    "breakdown":       "Breakdown",
    "totalPoints":     "Total points",
    "totalErrors":     "{{count}} total errors",
    "pointQuality":    "Point quality",
    "howPointsWon":    "How points are won",
    "positivePlay":    "Positive play",
    "ofOurPoints":     "of our points",
    "errorRatio":      "Error ratio",
    "mixed":           "Mixed",
    "assertive":       "Assertive",
    "errorDependent":  "Error-dependent",
    "sideoutPct":      "Sideout %",
    "breakPct":        "Break %",
    "serveErr":        "Serve err",
    "ourPoints":       "Our points",
    "errorPressure":   "Error pressure",
    "rolling":         "Rolling {{count}}",
    "fullMatch":       "Full match",
    "clustering":      "Clustering",
    "rotationStats":   "Rotation statistics",
    "perRotation":     "Per rotation",
    "building":        "Building…",
    "win":             "W",
    "loss":            "L",
    "servePct":        "Srv%",
    "receivePct":      "Rcv%",
    "clearBurstPattern":   "Clear burst pattern",
    "mildClustering":      "Mild clustering",
    "randomVariance":      "Random — normal variance",
    "systematicProblem":   "Systematic problem"
  },

  "timeline": {
    "title":           "Timeline",
    "newest":          "Newest",
    "ourPoint":        "Our point",
    "theirPoint":      "Their point",
    "ownPlay":         "Own play",
    "ourError":        "Our error",
    "theirPlay":       "Their play",
    "theirError":      "Their error",
    "rotated":         "Rotated",
    "timeout":         "Timeout: {{team}}",
    "substitution":    "#{{numberIn}} {{nameIn}} → #{{numberOut}} {{nameOut}}",
    "deleteRally":     "Delete this rally?",
    "calledAt":        "Called at {{score}}"
  },

  "postMatch": {
    "title":           "Match summary",
    "matchWon":        "Match won",
    "matchLost":       "Match lost",
    "sets":            "Sets",
    "rallies_one":     "{{count}} rally",
    "rallies_other":   "{{count}} rallies",
    "keyMetrics":      "Key metrics",
    "pointQuality":    "Point quality",
    "howPointsWon":    "How points were won",
    "positivePlay":    "Positive play",
    "sideoutQual":     "Sideout qual",
    "breakQual":       "Break qual",
    "setComparison":   "Set comparison",
    "allSets":         "All {{count}} sets",
    "setWon":          "S{{number}} W",
    "setLost":         "S{{number}} L",
    "score":           "Score",
    "sideout":         "Sideout",
    "errRatio":        "Err ratio",
    "posPlay":         "Pos play",
    "scoreTimeline":   "Score timeline",
    "leading":         "Leading",
    "trailing":        "Trailing",
    "rotationPerf":    "Rotation performance",
    "fullMatch":       "Win rate · full match",
    "matchInsights":   "Match insights",
    "strengthsFound":  "{{count}} found",
    "trainingPriorities": "Training priorities",
    "winProbability":  "Win probability",
    "rallySequence":   "Rally sequence",
    "createTraining":  "Create training from this",
    "exportPdf":       "PDF",
    "exportCsv":       "CSV",
    "aceLabel":        "Ace",
    "blockLabel":      "Block",
    "attackLabel":     "Attack",
    "oppError":        "Opp error",
    "positivePlaySplit": "Positive play split",
    "reinforce":       "reinforce"
  },

  "setSummary": {
    "title":           "Set summary",
    "setWon":          "Set {{number}} · Won",
    "setLost":         "Set {{number}} · Lost",
    "rallies_one":     "{{count}} rally",
    "rallies_other":   "{{count}} rallies",
    "leading":         "leading {{us}}–{{them}}",
    "trailing":        "trailing {{us}}–{{them}}",
    "thisSet":         "This set",
    "scoreTimeline":   "Score timeline",
    "rotationPerf":    "Rotation performance",
    "headsUp":         "Heads up for next set",
    "setupNextSet":    "Set up Set {{number}}",
    "fullMatchStats":  "Full match stats",
    "rotated":         "Rotated"
  },

  "seasons": {
    "title":           "Seasons",
    "newSeason":       "New season",
    "active":          "Active",
    "setActive":       "Set as active",
    "nameLabel":       "Season name",
    "namePlaceholder": "2025/26",
    "startDate":       "Start date",
    "endDate":         "End date",
    "endDateOptional": "End date (optional)",
    "setActiveToggle": "Set as active season",
    "deactivateWarning": "This will deactivate {{name}}. Continue?",
    "deleteWarning":   "This season has {{count}} games. Deleting it cannot be undone.",
    "gamesPlayed_one": "{{count}} game",
    "gamesPlayed_other":"{{count}} games",
    "empty":           "No seasons yet — create your first season"
  },

  "seasonOverview": {
    "title":           "Season overview",
    "kpiMatches":      "Win / Loss (matches)",
    "kpiSets":         "Win / Loss (sets)",
    "kpiPoints":       "Points",
    "kpiTime":         "Total playing time",
    "sideoutAvg":      "Sideout % avg",
    "breakAvg":        "Break % avg",
    "bestWin":         "Best win",
    "worstLoss":       "Worst loss",
    "trends":          "Trends across {{count}} matches",
    "gamesThisSeason": "Games this season"
  },

  "players": {
    "title":           "Players",
    "eyebrow":         "Active roster · {{count}} players",
    "addPlayer":       "Add player",
    "empty":           "No players yet — add your first player",
    "firstName":       "First name",
    "lastName":        "Last name",
    "birthday":        "Birthday",
    "height":          "Height (m)",
    "jersey":          "Jersey number",
    "positions":       "Positions",
    "hasLicense":      "Has officiating licence",
    "isLibero":        "Libero",
    "positionSetter":  "Setter",
    "positionOutside": "Outside",
    "positionOpposite":"Opposite",
    "positionMiddle":  "Middle",
    "positionLibero":  "Libero",
    "positionDS":      "DS",
    "deleteConfirm":   "Delete {{name}}? This cannot be undone."
  },

  "trainings": {
    "title":           "Trainings",
    "eyebrow":         "Sessions",
    "upcoming":        "Upcoming",
    "pastSessions":    "Past sessions",
    "newSession":      "New session",
    "empty":           "No training sessions yet",
    "nameLabel":       "Session name",
    "dateLabel":       "Date",
    "timeLabel":       "Time",
    "locationLabel":   "Location",
    "focusLabel":      "Focus areas",
    "notesLabel":      "Notes",
    "attendance":      "{{came}} came · {{absent}} absent",
    "pending_one":     "{{count}} pending",
    "pending_other":   "{{count}} pending",
    "focusServe":      "Serve",
    "focusReception":  "Reception",
    "focusAttack":     "Attack",
    "focusBlock":      "Block",
    "focusDefence":    "Defence",
    "focusRotation":   "Rotation",
    "focusFitness":    "Fitness",
    "startsIn":        "Starts in {{days}} days"
  },

  "settings": {
    "title":           "Settings",
    "account":         "Account",
    "teamName":        "Team name",
    "email":           "Email",
    "changePassword":  "Change password",
    "language":        "Language",
    "languageLabel":   "App language",
    "langEnglish":     "English",
    "langGerman":      "German (Deutsch)",
    "notifications":   "Notifications",
    "matchReminders":  "Match reminders",
    "matchRemindersSub": "Get notified 2 hours before every game",
    "analysisReady":   "Analysis ready",
    "analysisReadySub":  "When post-match analysis is complete",
    "tusWeights":      "TUS weights (advanced)",
    "tusWindow":       "TUS window size",
    "momentum":        "Momentum weight",
    "errorRatio":      "Error ratio weight",
    "leadDeficit":     "Lead/deficit weight",
    "positivePlay":    "Positive play weight",
    "weightSum":       "Weights must sum to 100%",
    "darkMode":        "Dark mode",
    "exportData":      "Export all data",
    "dangerZone":      "Danger zone",
    "deleteMatchData": "Delete all match data",
    "deleteAccount":   "Delete account",
    "signOut":         "Sign out",
    "joinTeam":        "Join another team",
    "joinTeamSub":     "Paste an invitation code",
    "version":         "Version {{version}}"
  },

  "teamSwitcher": {
    "title":           "Switch team",
    "subtitle_one":    "You are a member of {{count}} team",
    "subtitle_other":  "You are a member of {{count}} teams",
    "joinAnother":     "Join another team",
    "joinSub":         "Paste an invitation code",
    "seasons":         "Seasons · {{teamName}}",
    "roleManager":     "Manager",
    "rolePlayer":      "Player"
  },

  "subscription": {
    "trialEnded":      "Your free trial has ended",
    "trialEndedSub":   "Subscribe to keep logging — your stats and data are always yours.",
    "subscribeNow":    "Subscribe now",
    "remindLater":     "Remind me later",
    "graceBanner":     "Your free trial has ended · {{days}} days left to subscribe",
    "subscribe":       "Subscribe",
    "blockedTitle":    "Subscription required",
    "blockedSub":      "Subscribe to continue logging matches.",
    "lastMatch":       "Your last match: {{result}} vs {{opponent}}",
    "subscribeButton": "Subscribe to continue logging",
    "graceExpired":    "Your trial has expired"
  },

  "errors": {
    "generic":             "Something went wrong. Please try again.",
    "network":             "No internet connection.",
    "sessionExpired":      "Your session has expired. Please sign in again.",
    "invalidEmail":        "Please enter a valid email address.",
    "passwordTooShort":    "Password must be at least 8 characters.",
    "emailTaken":          "An account with this email already exists.",
    "invalidInviteCode":   "This code is invalid or has expired.",
    "inviteWrongEmail":    "This invitation was sent to a different email address.",
    "minPlayers":          "You need at least 6 players to start logging.",
    "jerseyTaken":         "Jersey number {{number}} is already taken.",
    "liberoBackRow":       "Libero must be placed in a back-row zone (1, 5, or 6).",
    "weightsSum":          "Weights must sum to 100%.",
    "undoUnavailable":     "Nothing to undo.",
    "setNotComplete":      "Set score conditions not yet met."
  },

  "empty": {
    "noGames":         "No games in this season yet — create your first game.",
    "noPlayers":       "No players yet — add your first player.",
    "noTrainings":     "No training sessions yet.",
    "noSeasons":       "No seasons yet — create your first season.",
    "noResults":       "No past results yet.",
    "noUpcoming":      "No upcoming games."
  },

  "positions": {
    "Setter":          "Setter",
    "Outside":         "Outside",
    "Opposite":        "Opposite",
    "Middle":          "Middle",
    "Libero":          "Libero",
    "DS":              "DS"
  },

  "matchStatus": {
    "upcoming":        "Upcoming",
    "inProgress":      "In progress",
    "completed":       "Completed"
  },

  "time": {
    "today":           "Today",
    "yesterday":       "Yesterday",
    "daysAgo_one":     "{{count}} day ago",
    "daysAgo_other":   "{{count}} days ago",
    "never":           "Never"
  }
}
```

### 5.3 `de.json` (German translations)

```json
{
  "common": {
    "save":          "Speichern",
    "cancel":        "Abbrechen",
    "delete":        "Löschen",
    "edit":          "Bearbeiten",
    "confirm":       "Bestätigen",
    "skip":          "Überspringen",
    "back":          "Zurück",
    "next":          "Weiter",
    "done":          "Fertig",
    "loading":       "Laden…",
    "error":         "Etwas ist schiefgelaufen",
    "retry":         "Erneut versuchen",
    "search":        "Suchen",
    "filter":        "Filtern",
    "all":           "Alle",
    "none":          "Keine",
    "yes":           "Ja",
    "no":            "Nein",
    "optional":      "Optional",
    "required":      "Pflichtfeld",
    "comingSoon":    "Demnächst verfügbar",
    "copiedToClipboard": "In die Zwischenablage kopiert"
  },

  "nav": {
    "home":          "Home",
    "games":         "Spiele",
    "trainings":     "Training",
    "players":       "Spieler",
    "settings":      "Einstellungen"
  },

  "auth": {
    "login": {
      "title":           "Willkommen zurück",
      "subtitle":        "Melde dich bei deinem Team-Konto an",
      "emailLabel":      "E-Mail",
      "emailPlaceholder":"trainer@volleyclub.de",
      "passwordLabel":   "Passwort",
      "forgotPassword":  "Passwort vergessen?",
      "signIn":          "Anmelden",
      "googleButton":    "Mit Google fortfahren",
      "noAccount":       "Noch kein Konto?",
      "createOne":       "Jetzt erstellen →"
    },
    "register": {
      "title":           "Konto erstellen",
      "subtitle":        "Du wirst Team-Manager",
      "inviteCode":      "Einladungscode",
      "inviteCodePlaceholder": "VB3X · 9KQM",
      "inviteValid":     "Tritt {{teamName}} als {{role}} bei ✓",
      "inviteInvalid":   "Dieser Code ist ungültig oder abgelaufen",
      "inviteWrongEmail":"Diese Einladung wurde an eine andere E-Mail-Adresse gesendet",
      "role":            "Rolle",
      "teamName":        "Teamname",
      "firstName":       "Vorname",
      "lastName":        "Nachname",
      "password":        "Passwort",
      "passwordHint":    "Mindestens 8 Zeichen",
      "terms":           "Ich stimme den {{terms}} und der {{privacy}} zu",
      "termsLink":       "Nutzungsbedingungen",
      "privacyLink":     "Datenschutzerklärung",
      "createButton":    "Team-Konto erstellen",
      "googleButton":    "Mit Google registrieren",
      "alreadyAccount":  "Bereits ein Konto?",
      "signIn":          "Anmelden →"
    },
    "totp": {
      "setupTitle":      "Zwei-Faktor-Authentifizierung einrichten",
      "setupSubtitle":   "Scanne diesen QR-Code mit deiner Authenticator-App",
      "verifyTitle":     "Authentifizierungscode eingeben",
      "verifySubtitle":  "Öffne deine Authenticator-App und gib den 6-stelligen Code ein",
      "codePlaceholder": "000 000",
      "verify":          "Bestätigen",
      "backupTitle":     "Backup-Codes speichern",
      "backupSubtitle":  "Bewahre diese sicher auf. Jeder Code ist nur einmal verwendbar.",
      "backupSaved":     "Ich habe meine Backup-Codes gespeichert",
      "invalidCode":     "Ungültiger Code. Bitte erneut versuchen.",
      "lockedOut":       "Zu viele fehlgeschlagene Versuche. Versuche es in {{minutes}} Minuten erneut."
    }
  },

  "onboarding": {
    "stepTeam":        "Team bestätigt",
    "stepPlayers":     "Erste Spieler hinzufügen",
    "stepSeason":      "Erste Saison erstellen",
    "stepDone":        "Alles bereit",
    "welcomeTitle":    "Willkommen bei {{teamName}}, {{firstName}}!",
    "welcomeSubtitle": "Du bist als {{role}} eingerichtet. Schließe ein paar schnelle Schritte ab.",
    "addPlayers":      "Erste Spieler hinzufügen",
    "skipSetup":       "Setup überspringen, zum Dashboard",
    "goToDashboard":   "Zum Dashboard",
    "roleManager":     "Cheftrainer / Team-Manager",
    "rolePlayer":      "Spieler"
  },

  "dashboard": {
    "greeting":            "Hallo, {{firstName}} 👋",
    "seasonSnapshot":      "Saisonüberblick",
    "seasonPerformance":   "Saisonleistung",
    "lastMatch":           "Letztes Spiel · vs {{opponent}}",
    "trainingFocus":       "Trainingsschwerpunkte",
    "seasonResults":       "Saisonergebnisse",
    "upcoming":            "Anstehend",
    "record":              "Bilanz",
    "pointsRatio":         "Punkteverhältnis",
    "sideoutPct":          "Sideout %",
    "breakPct":            "Break %",
    "targetMet":           "Ziel ≥{{value}}% ✓",
    "targetNotMet":        "Ziel ≥{{value}}%",
    "sideout":             "Sideout",
    "breakPoint":          "Break",
    "serveErr":            "Aufschlagfehler",
    "trendFullView":       "Vollansicht",
    "weakestRotation":     "Schwächste Rotation: {{rotation}} ({{pct}}%)",
    "viewDetails":         "Details anzeigen →",
    "noSeasonYet":         "Erstelle deine erste Saison",
    "noGamesYet":          "Noch keine Spiele in dieser Saison",
    "winRecord":           "{{wins}}–{{losses}}"
  },

  "games": {
    "title":           "Spiele",
    "eyebrow":         "Spielplan",
    "upcoming":        "Anstehend",
    "pastResults":     "Vergangene Ergebnisse",
    "all":             "Alle",
    "playing":         "Spielend",
    "officiating":     "Schiedsrichter",
    "sets":            "Sätze",
    "wonBadge":        "S",
    "lostBadge":       "N",
    "liveBadge":       "Live",
    "officBadge":      "Schiedsrichter",
    "actionLog":       "Erfassen",
    "actionStats":     "Statistik",
    "actionEdit":      "Bearbeiten",
    "deleteConfirm":   "Dieses Spiel löschen? Das kann nicht rückgängig gemacht werden.",
    "empty":           "Noch keine Spiele in dieser Saison",
    "emptyNoSeason":   "Erstelle zuerst eine Saison",
    "setLineup":       "Aufstellung festlegen"
  },

  "liveLog": {
    "set":             "Satz {{number}}",
    "tabLog":          "Erfassen",
    "tabStats":        "Statistik",
    "tabTimeline":     "Verlauf",
    "tabTactics":      "Taktik",
    "undoLastPoint":   "Letzten Punkt rückgängig",
    "actionLineup":    "Aufstellung",
    "actionSub":       "Wechsel",
    "actionTimeout":   "Auszeit",
    "actionEndSet":    "Satz beenden",
    "subsUsed":        "{{used}}/{{max}}",
    "rotation":        "Rotation",
    "endSetConfirm":   "Satz {{number}} beenden? Stand: {{us}} – {{them}}",
    "endMatchConfirm": "Spiel beenden?",
    "subTitle":        "Spielerwechsel",
    "subPlayerOff":    "Spieler raus",
    "subPlayerOn":     "Spieler rein",
    "liberoSwap":      "Libero-Wechsel",
    "timeoutTitle":    "Auszeit",
    "timeoutUs":       "Unsere Auszeit",
    "timeoutThem":     "Auszeit Gegner",
    "autoFallback":    "Automatisch als eigener Punkt gespeichert"
  },

  "stats": {
    "timeoutUrgency":  "Auszeit-Dringlichkeit",
    "stable":          "Stabil",
    "watch":           "Beobachten",
    "considerTimeout": "Auszeit erwägen",
    "callTimeoutNow":  "Jetzt Auszeit nehmen",
    "breakdown":       "Aufschlüsselung",
    "totalPoints":     "Gesamtpunkte",
    "totalErrors":     "{{count}} Fehler",
    "pointQuality":    "Punktqualität",
    "howPointsWon":    "Wie Punkte gewonnen werden",
    "positivePlay":    "Positives Spiel",
    "ofOurPoints":     "unserer Punkte",
    "errorRatio":      "Fehlerverhältnis",
    "mixed":           "Gemischt",
    "assertive":       "Aktiv",
    "errorDependent":  "Fehlerabhängig",
    "sideoutPct":      "Sideout %",
    "breakPct":        "Break %",
    "serveErr":        "Aufschlagfehler",
    "ourPoints":       "Unsere Punkte",
    "errorPressure":   "Fehlerdruck",
    "rolling":         "Rollend {{count}}",
    "fullMatch":       "Gesamtspiel",
    "clustering":      "Fehlerballung",
    "rotationStats":   "Rotationsstatistik",
    "perRotation":     "Pro Rotation",
    "building":        "Wird berechnet…",
    "win":             "S",
    "loss":            "N",
    "servePct":        "Aufs%",
    "receivePct":      "Annh%",
    "clearBurstPattern":   "Klares Häufungsmuster",
    "mildClustering":      "Leichte Häufung",
    "randomVariance":      "Zufällig — normale Varianz",
    "systematicProblem":   "Systematisches Problem"
  },

  "players": {
    "title":           "Spieler",
    "eyebrow":         "Aktiver Kader · {{count}} Spieler",
    "addPlayer":       "Spieler hinzufügen",
    "empty":           "Noch keine Spieler — füge deinen ersten Spieler hinzu",
    "firstName":       "Vorname",
    "lastName":        "Nachname",
    "birthday":        "Geburtstag",
    "height":          "Größe (m)",
    "jersey":          "Trikotnummer",
    "positions":       "Positionen",
    "hasLicense":      "Schiedsrichterlizenz",
    "isLibero":        "Libero",
    "positionSetter":  "Zuspieler",
    "positionOutside": "Außenangreifer",
    "positionOpposite":"Diagonalangreifer",
    "positionMiddle":  "Mittelblocker",
    "positionLibero":  "Libero",
    "positionDS":      "Abwehrspezialist",
    "deleteConfirm":   "{{name}} löschen? Das kann nicht rückgängig gemacht werden."
  },

  "trainings": {
    "title":           "Training",
    "eyebrow":         "Einheiten",
    "upcoming":        "Anstehend",
    "pastSessions":    "Vergangene Einheiten",
    "newSession":      "Neue Einheit",
    "empty":           "Noch keine Trainingseinheiten",
    "nameLabel":       "Name der Einheit",
    "dateLabel":       "Datum",
    "timeLabel":       "Uhrzeit",
    "locationLabel":   "Ort",
    "focusLabel":      "Schwerpunkte",
    "notesLabel":      "Notizen",
    "attendance":      "{{came}} anwesend · {{absent}} gefehlt",
    "pending_one":     "{{count}} ausstehend",
    "pending_other":   "{{count}} ausstehend",
    "focusServe":      "Aufschlag",
    "focusReception":  "Annahme",
    "focusAttack":     "Angriff",
    "focusBlock":      "Block",
    "focusDefence":    "Abwehr",
    "focusRotation":   "Rotation",
    "focusFitness":    "Kondition",
    "startsIn":        "Beginnt in {{days}} Tagen"
  },

  "settings": {
    "title":           "Einstellungen",
    "account":         "Konto",
    "teamName":        "Teamname",
    "email":           "E-Mail",
    "changePassword":  "Passwort ändern",
    "language":        "Sprache",
    "languageLabel":   "App-Sprache",
    "langEnglish":     "Englisch (English)",
    "langGerman":      "Deutsch",
    "notifications":   "Benachrichtigungen",
    "matchReminders":  "Spielerinnerungen",
    "matchRemindersSub": "2 Stunden vor jedem Spiel benachrichtigt werden",
    "analysisReady":   "Analyse bereit",
    "analysisReadySub":  "Wenn die Nachspielanalyse abgeschlossen ist",
    "tusWeights":      "TUS-Gewichtungen (Erweitert)",
    "tusWindow":       "TUS-Fenstergröße",
    "signOut":         "Abmelden",
    "joinTeam":        "Einem weiteren Team beitreten",
    "joinTeamSub":     "Einladungscode eingeben",
    "version":         "Version {{version}}"
  },

  "errors": {
    "generic":             "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    "network":             "Keine Internetverbindung.",
    "sessionExpired":      "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
    "invalidEmail":        "Bitte gib eine gültige E-Mail-Adresse ein.",
    "passwordTooShort":    "Das Passwort muss mindestens 8 Zeichen lang sein.",
    "emailTaken":          "Ein Konto mit dieser E-Mail-Adresse existiert bereits.",
    "invalidInviteCode":   "Dieser Code ist ungültig oder abgelaufen.",
    "inviteWrongEmail":    "Diese Einladung wurde an eine andere E-Mail-Adresse gesendet.",
    "minPlayers":          "Du brauchst mindestens 6 Spieler zum Erfassen.",
    "jerseyTaken":         "Trikotnummer {{number}} ist bereits vergeben.",
    "liberoBackRow":       "Der Libero muss in einer Hinterreihen-Zone stehen (1, 5 oder 6).",
    "weightsSum":          "Die Gewichtungen müssen 100 % ergeben.",
    "undoUnavailable":     "Nichts rückgängig zu machen.",
    "setNotComplete":      "Satzbedingungen noch nicht erfüllt."
  },

  "subscription": {
    "trialEnded":      "Deine kostenlose Testphase ist beendet",
    "trialEndedSub":   "Abonniere, um weiter zu erfassen — deine Statistiken und Daten gehören dir.",
    "subscribeNow":    "Jetzt abonnieren",
    "remindLater":     "Später erinnern",
    "graceBanner":     "Deine Testphase ist beendet · noch {{days}} Tage zum Abonnieren",
    "subscribe":       "Abonnieren",
    "blockedTitle":    "Abonnement erforderlich",
    "blockedSub":      "Abonniere, um weiter Spiele zu erfassen.",
    "lastMatch":       "Dein letztes Spiel: {{result}} vs {{opponent}}",
    "subscribeButton": "Abonnieren und weiter erfassen",
    "graceExpired":    "Deine Testphase ist abgelaufen"
  },

  "positions": {
    "Setter":          "Zuspieler",
    "Outside":         "Außenangreifer",
    "Opposite":        "Diagonalangreifer",
    "Middle":          "Mittelblocker",
    "Libero":          "Libero",
    "DS":              "Abwehrspezialist"
  },

  "time": {
    "today":           "Heute",
    "yesterday":       "Gestern",
    "daysAgo_one":     "vor {{count}} Tag",
    "daysAgo_other":   "vor {{count}} Tagen",
    "never":           "Nie"
  }
}
```

---

## 6. Language selector in Settings

### 6.1 UI

The language selector appears in the Settings page under the "Account" section.

```
LANGUAGE
─────────────────────────────────
App language

  ● English
  ○ Deutsch

```

Rendered as two tappable rows with a radio-style selection indicator
(turquoise filled circle for active, empty circle for inactive).
Selecting a language updates immediately — no "save" button needed.

### 6.2 Component

```typescript
// src/components/settings/LanguageSelector.tsx
import { useTranslation } from 'react-i18next'
import { changeLanguage }  from '../../lib/i18n'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
]

export function LanguageSelector() {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <div className="field-label">{t('settings.languageLabel')}</div>
      {LANGUAGES.map(lang => (
        <div
          key={lang.code}
          onClick={() => changeLanguage(lang.code as 'en' | 'de')}
          className={`language-row ${i18n.language === lang.code ? 'active' : ''}`}
        >
          <div className={`radio-dot ${i18n.language === lang.code ? 'filled' : ''}`} />
          <span>{lang.label}</span>
          {i18n.language === lang.code && (
            <i className="ti ti-check" style={{ color: 'var(--turq)', marginLeft: 'auto' }} />
          )}
        </div>
      ))}
    </div>
  )
}
```

---

## 7. Email templates (Resend)

Email templates in `api/src/lib/email.ts` must be duplicated in both languages.
The user's `locale` is passed to each email function.

```typescript
export async function sendManagerInviteEmail(params: {
  to:        string
  code:      string
  expiresAt: Date
  invitedBy: string
  locale:    'en' | 'de'
}): Promise<boolean> {

  const content = params.locale === 'de' ? {
    subject:  'Du wurdest zu Rallytics eingeladen',
    heading:  'Du wurdest eingeladen, ein Team auf Rallytics zu verwalten',
    body:     `${params.invitedBy} hat dich als <strong>Cheftrainer / Team-Manager</strong> eingeladen.`,
    codeLabel:'Dein Einladungscode',
    validity: `Gültig bis ${params.expiresAt.toLocaleDateString('de-DE', { day:'numeric', month:'long', year:'numeric' })} · einmalig verwendbar`,
    cta:      'Konto erstellen →',
    footer:   `Gehe zu ${APP}/auth/register und gib deinen Einladungscode ein.`,
  } : {
    subject:  'You have been invited to Rallytics',
    heading:  "You've been invited to manage a team on Rallytics",
    body:     `${params.invitedBy} has invited you as <strong>Head Coach / Team Manager</strong>.`,
    codeLabel:'Your invitation code',
    validity: `Valid until ${params.expiresAt.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })} · single use`,
    cta:      'Create your account →',
    footer:   `Go to ${APP}/auth/register and paste your invitation code.`,
  }

  // ... rest of email send logic using content object
}
```

Apply the same pattern to `sendPlayerInviteEmail()`, `sendWelcomeEmail()`,
and all re-engagement email templates.

The `locale` to pass comes from:
- For invitation emails: the `locale` stored in the DB for the invited user if
  they already exist, otherwise default to `'de'` for German-market invites
- For emails triggered after login: `req.user.locale`
- For cron-triggered re-engagement emails: `user.locale` from the DB

---

## 8. Analysis microservice (Python)

The analysis microservice generates insight card text in full sentences. These
must be templated in both languages.

### 8.1 Locale parameter

When VB Manager triggers analysis on match completion, include the manager's
locale in the request:

```
POST /analyse/{match_id}
Body: { match_id, locale: "de" }
```

The `locale` is stored in `match_analysis.result` and used when rendering
insight cards.

### 8.2 Template structure in Python

```python
# analysis-service/insights/templates.py

TEMPLATES = {
    'en': {
        'own_err_serve': (
            "Your own error rate on service rallies is {current:.1%} — "
            "target below {target:.0%}. Focus on serve consistency in training. "
            "Fixing this alone is worth +{impact:.1%} win rate."
        ),
        'own_err_receive': (
            "Your own error rate on reception rallies is {current:.1%} — "
            "target below {target:.0%}. Work on pass quality and attack "
            "decision-making. Fixing this is worth +{impact:.1%} win rate."
        ),
        'rotation_weak': (
            "Rotation {rotation} is critically weak (RE={current:.2f}). "
            "Run dedicated drills starting from this rotation's configuration."
        ),
        'strength_sideout': (
            "Sideout system reliable at {current:.0%} — reception and "
            "first-ball attack working above the {target:.0%} threshold."
        ),
        'strength_ace_rate': (
            "Ace rate {current:.0%} this match — strong serving pressure. "
            "R{best_rotation} ace rate {best_rate:.0%} is your highest. "
            "Preserve this serving structure."
        ),
        'late_match_drop': (
            "Performance drops significantly in sets 4 and 5. Work on "
            "conditioning for match duration and high-pressure set scenarios "
            "from 15 points onwards."
        ),
    },
    'de': {
        'own_err_serve': (
            "Deine eigene Fehlerquote bei Aufschlagwechseln beträgt {current:.1%} — "
            "Ziel: unter {target:.0%}. Konzentriere dich im Training auf "
            "Aufschlagkonstanz. Die Behebung dieses Problems ist +{impact:.1%} "
            "Gewinnwahrscheinlichkeit wert."
        ),
        'own_err_receive': (
            "Deine Fehlerquote bei Annahmewechseln beträgt {current:.1%} — "
            "Ziel: unter {target:.0%}. Arbeite an der Annahmequalität und "
            "Angriffsentscheidungen. +{impact:.1%} Gewinnwahrscheinlichkeit möglich."
        ),
        'rotation_weak': (
            "Rotation {rotation} ist kritisch schwach (RE={current:.2f}). "
            "Führe gezielte Übungen ausgehend von dieser Rotationskonfiguration durch."
        ),
        'strength_sideout': (
            "Sideout-System zuverlässig bei {current:.0%} — Annahme und "
            "erster Ball über dem Schwellenwert von {target:.0%}."
        ),
        'strength_ace_rate': (
            "Ass-Quote {current:.0%} in diesem Spiel — starker Aufschlagdruck. "
            "R{best_rotation} Ass-Quote {best_rate:.0%} ist deine höchste. "
            "Bewahre diese Aufschlagstruktur."
        ),
        'late_match_drop': (
            "Leistung bricht in Sätzen 4 und 5 deutlich ein. Arbeite an der "
            "Kondition für die Spieldauer und an Drucksituationen ab 15 Punkten."
        ),
    }
}
```

---

## 9. Implementation order

1. **Install dependencies** — `i18next`, `react-i18next`,
   `i18next-browser-languagedetector`

2. **Create `web/src/lib/i18n.ts`** — configuration as specified in §3.1

3. **Create translation files** — `en.json` and `de.json` with all keys from §5

4. **Create `web/src/lib/format.ts`** — all date, number, and currency
   formatting utilities

5. **Add `users.locale` DB column** — migration, update `PATCH /api/auth/me`
   to accept `locale`

6. **Replace all hardcoded strings** in existing components with `t()` calls,
   working through the app page by page in this order:
   - Common components (Button, Badge, Card titles)
   - Nav bar
   - Dashboard
   - Games list + game wizard
   - Live log (all three tabs)
   - Post-match summary + set summary
   - Players
   - Trainings
   - Settings
   - Auth pages
   - Error messages and empty states

7. **Replace all hardcoded date/number formatting** with calls to `format.ts`

8. **Add LanguageSelector component** to Settings page (§6)

9. **Update email templates** in `api/src/lib/email.ts` to accept and use
   `locale` parameter (§7)

10. **Update analysis microservice** — add `locale` parameter to
    `/analyse/{match_id}` and use `TEMPLATES[locale]` for insight card text (§8)

---

## 10. Adding a new language in future

When adding a third language (e.g. French):

1. Add `fr` to `supportedLngs` in `i18n.ts`
2. Create `web/src/locales/fr.json` using `en.json` as the template
3. Add `{ code: 'fr', label: 'Français' }` to the `LANGUAGES` array in
   `LanguageSelector.tsx`
4. Add French templates to `TEMPLATES` in the analysis microservice
5. Add French email content to each email function in `email.ts`
6. Update `users.locale` DB column type to accept `'fr'`

No other changes are needed — the i18next fallback chain handles any missing
keys gracefully by falling back to English.
