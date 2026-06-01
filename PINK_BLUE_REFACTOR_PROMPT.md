# Design Refactor Prompt — courtside	
## Pink / Blue / Black Palette

---

## 0. Instructions for Claude Code

Read this entire document before writing a single line of code.

You are performing a **pure visual design refactor** of courtside — a mobile-first
volleyball team management and match logging PWA built with React 18 + Vite,
Tailwind CSS, TypeScript, and Node.js/Express.

**Nothing changes except visual presentation.** Specifically:

- All routing, navigation, and page structure → **unchanged**
- All data fetching, API calls, React Query hooks → **unchanged**
- All Zustand store logic → **unchanged**
- All business logic (rotation, TUS, statistics, clustering) → **unchanged**
- All form validation and submission → **unchanged**
- All role guards and authentication flow → **unchanged**
- Database schema, Prisma models, API routes → **unchanged**
- Docker Compose configuration → **unchanged**
- Chart.js / Recharts data logic → only update visual config (colours, grid, axes)
- PWA manifest → update only `theme_color` to `#23B5D3` and `background_color` to `#000000`

The app currently uses a dark theme with orange (`#FF5C00`) as the primary accent,
green for wins/positive states, and red for losses/negative states.

You are replacing this with the **Pitch Black / Bubblegum Pink / Turquoise / Blue Bell**
palette described below. **Green and red must not appear anywhere in the output.**
This is a hard constraint — not a guideline.

---

## 1. Design token system

Implement these as the single source of truth across the entire codebase.

### 1.1 Tailwind config extension

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: '#000000',   // page / body background
          900: '#070600',   // Pitch Black — app shell
          800: '#0F0E0C',   // top bars, nav bars, sticky chrome
          700: '#161412',   // card surfaces
          600: '#1E1C18',   // elevated surfaces inside cards
          500: '#252320',   // inner panels, track backgrounds
          400: '#2F2D28',   // borders, dividers
          300: '#3D3B35',   // muted dividers
        },
        turq: {
          600: '#0F6E8A',   // deep turquoise — muted warning, below-target
          500: '#23B5D3',   // Turquoise Surf — primary accent
          400: '#4EC8E4',   // lighter turquoise — secondary positive
          300: '#8DDFF0',   // pale turquoise
        },
        bell: {
          600: '#0F5A9A',   // deep blue
          500: '#279AF1',   // Blue Bell — secondary accent
          400: '#5BB4F5',   // lighter blue
          300: '#9DD2FA',   // pale blue
        },
        bubb: {
          700: '#A82848',   // deep pink — heavy loss / critical
          500: '#EA526F',   // Bubblegum Pink — loss / error / alert
          400: '#F07A90',   // lighter pink
          300: '#F8AABB',   // pale pink
        },
        ghost: {
          100: '#F7F7FF',   // Ghost White — primary text
          200: '#C8C8D8',   // secondary text
          300: '#8A8A9A',   // muted text
          400: '#4A4A5A',   // very muted — section labels, metadata
        },
      },
      fontFamily: {
        sans:    ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },
  plugins: [],
}

export default config
```

### 1.2 CSS custom properties

Add to `src/index.css` — required for Chart.js, canvas, and any inline styles
that cannot use Tailwind utilities:

```css
:root {
  /* surfaces */
  --pitch-950: #000000;
  --pitch-900: #070600;
  --pitch-800: #0F0E0C;
  --pitch-700: #161412;
  --pitch-600: #1E1C18;
  --pitch-500: #252320;
  --pitch-400: #2F2D28;
  --pitch-300: #3D3B35;

  /* turquoise */
  --turq-600: #0F6E8A;
  --turq-500: #23B5D3;
  --turq-400: #4EC8E4;
  --turq-300: #8DDFF0;

  /* blue bell */
  --bell-500: #279AF1;
  --bell-400: #5BB4F5;
  --bell-300: #9DD2FA;

  /* bubblegum pink */
  --bubb-700: #A82848;
  --bubb-500: #EA526F;
  --bubb-400: #F07A90;
  --bubb-300: #F8AABB;

  /* text */
  --ghost-100: #F7F7FF;
  --ghost-200: #C8C8D8;
  --ghost-300: #8A8A9A;
  --ghost-400: #4A4A5A;
}
```

### 1.3 Grain texture utility

Add this global CSS. It applies a subtle film-grain overlay across the entire app
using an SVG fractal noise filter. This is a design requirement — not optional.

```css
/* src/index.css — add after :root */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.20;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  mix-blend-mode: overlay;
}
```

### 1.4 Shared chart theme

Create this file. Every Chart.js and Recharts instance must import from it.
No chart may hardcode a colour string.

```typescript
// src/lib/chartTheme.ts
export const chartTheme = {
  // primary series colours
  turq:       '#23B5D3',
  turqLight:  '#4EC8E4',
  bell:       '#279AF1',
  bellLight:  '#5BB4F5',
  pink:       '#EA526F',
  pinkDeep:   '#A82848',

  // fills for area charts
  turqFill:   'rgba(35,181,211,0.15)',
  pinkFill:   'rgba(234,82,111,0.15)',
  bellFill:   'rgba(39,154,241,0.12)',

  // axes + grid
  gridColor:  'rgba(47,45,40,0.80)',
  tickColor:  '#4A4A5A',

  // tooltip
  tooltip: {
    backgroundColor: '#161412',
    titleColor:      '#F7F7FF',
    bodyColor:       '#8A8A9A',
    padding:         8,
    cornerRadius:    6,
  },
}
```

---

## 2. Status colour semantics

This section is the most critical. Read it carefully before touching any component.

**There is no green and no red in this design system. This is absolute.**

All status signals are encoded using the Turquoise / Blue Bell / Bubblegum Pink palette.

### 2.1 Match and set results

| Result | Background | Text / Border | Notes |
|---|---|---|---|
| Dominant win (3–0) | `rgba(35,181,211,0.15)` | `turq-500` `#23B5D3` | Brightest turquoise |
| Win (3–1) | `rgba(35,181,211,0.12)` | `turq-500` `#23B5D3` | Standard win |
| Tight win (3–2) | `rgba(39,154,241,0.12)` | `bell-400` `#5BB4F5` | Blue bell — close |
| Loss | `rgba(234,82,111,0.12)` | `bubb-400` `#F07A90` | Pink receding |
| Heavy loss (0–3) | `rgba(234,82,111,0.18)` | `bubb-500` `#EA526F` | Deeper pink |

### 2.2 KPI / metric values

| State | Colour token | Hex | Condition |
|---|---|---|---|
| On target / good | `turq-500` | `#23B5D3` | Meets or exceeds target |
| Strong / best | `turq-400` | `#4EC8E4` | Significantly above target |
| Watch / slightly below | `bell-500` | `#279AF1` | Slightly below target |
| Poor / critical | `bubb-500` | `#EA526F` | Well below target |
| Neutral | `ghost-100` | `#F7F7FF` | No target or context-free |

### 2.3 KPI bar fills

| State | Fill colour |
|---|---|
| On target | `#23B5D3` |
| Strong | `#4EC8E4` |
| Watch / below | `#0F6E8A` |
| Poor / critical | `#A82848` |

### 2.4 Rotation grid cells (6-cell heatmap)

| Performance | Background | Text colour | Token name |
|---|---|---|---|
| Strong ≥70% | `rgba(35,181,211,0.22)` | `#23B5D3` | `rot-strong` |
| Solid 55–69% | `rgba(39,154,241,0.15)` | `#5BB4F5` | `rot-solid` |
| Weak 40–54% | `rgba(234,82,111,0.12)` | `#F07A90` | `rot-weak` |
| Critical <40% | `rgba(234,82,111,0.22)` | `#EA526F` | `rot-crit` |

### 2.5 Badges

```tsx
// Always use these exact class combinations
const badgeVariants = {
  win:  'bg-turq-500/15  text-turq-500  border border-turq-500/30',
  loss: 'bg-bubb-500/15  text-bubb-400  border border-bubb-500/30',
  warn: 'bg-bell-500/12  text-bell-400  border border-bell-500/25',
  info: 'bg-pitch-500/60 text-ghost-200 border border-pitch-400',
  live: 'bg-turq-500/15  text-turq-500  border border-turq-500/35',
}
```

### 2.6 Set score pills (in game cards and match summary)

```tsx
// Won set
'bg-turq-500/15 text-turq-500'
// Lost set
'bg-bubb-500/12 text-bubb-400'
// Neutral / no data
'bg-pitch-600 text-ghost-300'
```

### 2.7 Training focus tags

Each focus type gets a distinct colour from the palette. Do not use the same
colour for all tags:

```tsx
const focusTagVariants = {
  serve:    'bg-bubb-500/12 text-bubb-500  border border-bubb-500/25',
  reception:'bg-turq-500/12 text-turq-500  border border-turq-500/25',
  attack:   'bg-bubb-500/12 text-bubb-400  border border-bubb-500/20',
  block:    'bg-bell-500/12 text-bell-400  border border-bell-500/25',
  defence:  'bg-turq-400/10 text-turq-400  border border-turq-400/20',
  rotation: 'bg-bell-500/10 text-bell-500  border border-bell-500/20',
  fitness:  'bg-bubb-700/15 text-bubb-400  border border-bubb-700/20',
}
```

### 2.8 Player position colours

Each position gets a distinct colour within the palette:

```tsx
const positionColours = {
  Setter:   'text-bell-500',    // #279AF1 — organisational
  Outside:  'text-turq-500',    // #23B5D3 — primary attacker
  Opposite: 'text-bubb-400',    // #F07A90 — high-intensity
  Middle:   'text-bell-400',    // #5BB4F5 — front row
  Libero:   'text-bubb-500',    // #EA526F — unique defensive role
  DS:       'text-ghost-300',   // #8A8A9A — defensive specialist
}
```

Player avatar borders and background tints follow the same position colour.
Jersey badges: Setter = `bell-500`, Outside = `turq-500`, Opposite = `bubb-500`,
Middle = `bell-400`, Libero = `bubb-500`, DS = `pitch-500` with `ghost-300` text.

### 2.9 Score timeline (score difference chart)

- Line colour: **segment-based** — `turq-500` when value ≥ 0, `bubb-500` when < 0
- Fill above zero: `rgba(35,181,211,0.15)`
- Fill below zero: `rgba(234,82,111,0.15)`
- Zero line: `rgba(47,45,40,0.80)`, 1px, no markers

### 2.10 Error clustering bars

```typescript
// Three-tier using palette only
backgroundColor: cluster.map(v =>
  v > 0.5  ? '#EA526F' :          // bubb-500 — burst pattern (bad)
  v > 0.2  ? 'rgba(39,154,241,0.65)' : // bell-500 — mild clustering
             '#23B5D3'               // turq-500 — random/good
)
```

### 2.11 Points flow chart (scored vs conceded)

Use solid colours — no opacity:

```typescript
{ label: 'Scored',   backgroundColor: '#23B5D3' }  // turq-500
{ label: 'Conceded', backgroundColor: '#EA526F' }  // bubb-500
```

### 2.12 Rally dot strip

| Point type | Colour |
|---|---|
| Our point (positive play) | `#23B5D3` solid |
| Our point (opp error) | `rgba(35,181,211,0.50)` |
| Their point (their play) | `#EA526F` solid |
| Their point (our error) | `rgba(234,82,111,0.45)` |
| Set separator | `pitch-600` bg, `pitch-400` border |

### 2.13 TUS bar

- Track background: `pitch-600`
- Fill: gradient `linear-gradient(90deg, #23B5D3, #EA526F)` — calm to urgent
- Threshold labels: Watch = `bell-500`, Consider = `bubb-400`, Call now = `bubb-500`

### 2.14 Sparklines (dashboard entry card)

```typescript
spark('sideout',    data, '#23B5D3')  // turq-500
spark('errorRatio', data, '#EA526F')  // bubb-500
spark('breakPct',   data, '#279AF1')  // bell-500
```

---

## 3. Surface and elevation system

Depth is communicated by stepping through the pitch scale. No box shadows except
on primary CTA buttons. No solid black borders — use pitch-scale rgba values.

| Level | Token | Value | Used for |
|---|---|---|---|
| 0 — Page | `pitch-950` | `#000000` | Body background |
| 1 — Shell | `pitch-900` | `#070600` | App chrome, phone border |
| 2 — Chrome | `pitch-800` | `#0F0E0C` | Top bars, nav bar, sticky headers |
| 3 — Card | `pitch-700` | `#161412` | Primary card surfaces |
| 4 — Elevated | `pitch-600` | `#1E1C18` | Stat boxes inside cards, inner panels |
| 5 — Deep | `pitch-500` | `#252320` | Track backgrounds, separators |
| Border | `pitch-400` | `#2F2D28` | All card and component borders |

All borders: `1px solid rgba(47,45,40,0.90)` — use rgba form for consistency.

---

## 4. Typography

### Fonts

Add to `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Montserrat:wght@600;700;800&display=swap" rel="stylesheet">
```

### Type scale

| Role | Font | Size | Weight | Colour | Notes |
|---|---|---|---|---|---|
| App name | Montserrat | 15px | 600 | `ghost-100` | Header |
| Page title | Montserrat | 30px | 800 | `ghost-100` | Games, Players, Trainings headers |
| Hero score | Montserrat | 64px | 800 | contextual | Live log score |
| Match score | Montserrat | 52px | 700 | contextual | Summary hero |
| Stat value | Montserrat | 24px | 600 | contextual | KPI tiles |
| Card title | Inter | 11px | 600 | `ghost-300` | ALL CAPS, 0.07em tracking |
| Section label | Inter | 11px | 700 | `turq-500` | ALL CAPS, 0.09em, left accent bar |
| Page eyebrow | Inter | 11px | 600 | `turq-500` | ALL CAPS, 0.09em |
| Body | Inter | 12–14px | 400–500 | `ghost-100` | |
| Secondary | Inter | 11–12px | 400 | `ghost-300` | Supporting info |
| Metadata | Inter | 10–11px | 400 | `ghost-400` | Timestamps, counts |
| Badge | Inter | 10px | 600 | contextual | Status pills |

---

## 5. Component specifications

### 5.1 Body and page background

```css
html, body { background: #000000; }
```

### 5.2 App shell

```
background:    pitch-900  (#070600)
border-radius: 32px (mobile), 24px (inner pages)
box-shadow:    0 0 0 1px rgba(35,181,211,0.12), 0 32px 80px rgba(0,0,0,0.9)
```

### 5.3 Top bar / back header

```
background:    pitch-800  (#0F0E0C)
border-bottom: 1px solid rgba(47,45,40,0.90)
padding:       14px 16px 12px
context text:  ghost-300  11px Inter
title text:    ghost-100  15px Inter 600
icons:         ghost-300  20px
```

### 5.4 Navigation bar

```
background:    pitch-800
border-top:    1px solid rgba(47,45,40,0.90)
padding:       10px top, 18px bottom
active item:   turq-500  (#23B5D3)
inactive item: ghost-400 (#4A4A5A)
active dot:    5×5px circle, turq-500, below label
```

### 5.5 Page header (Games / Trainings / Players)

```
eyebrow:       11px Inter 600, turq-500, ALL CAPS, 0.09em tracking
title:         30px Montserrat 800, ghost-100, letter-spacing -0.02em
FAB button:    linear-gradient(135deg, turq-500, bell-500), color #000
               44×44px, border-radius 50%
               box-shadow: 0 4px 16px rgba(35,181,211,0.35)
```

### 5.6 Section labels

```
font:          11px Inter 700
colour:        turq-500
case:          ALL CAPS
letter-spacing: 0.09em
left accent:   3×14px, border-radius 2px, background turq-500
margin:        18px top, 10px bottom
```

### 5.7 Filter pills (Games page)

```
active:    linear-gradient(135deg, turq-500, bell-500), color #000
inactive:  pitch-700 bg, ghost-300 text, pitch-400 border
font:      12px Inter 600, ALL CAPS, 0.04em tracking
padding:   7px 16px, border-radius 999px
```

### 5.8 KPI tiles

```
background:    pitch-700
border:        1px solid rgba(47,45,40,0.90)
border-radius: 12px
padding:       13px 12px
label:         10px Inter 600, ghost-300, ALL CAPS, 0.07em
value:         24px Montserrat 600, contextual (see §2.2)
sub:           11px Inter, ghost-400
bar track:     3px, pitch-500, border-radius 2px, margin-top 9px
bar fill:      contextual (see §2.3)
```

### 5.9 Cards (general)

```
background:    pitch-700
border:        1px solid rgba(47,45,40,0.90)
border-radius: 12–14px
padding:       14px
card title:    11px Inter 600, ghost-300, ALL CAPS, 0.07em
```

### 5.10 Stat boxes (inside cards)

```
background:    pitch-600
border:        1px solid rgba(47,45,40,0.90)
border-radius: 8px
padding:       10px 12px
label:         10px Inter, ghost-400, ALL CAPS, 0.05em
value:         20px Montserrat 600, contextual
sub:           10px Inter, ghost-400
```

### 5.11 Game cards

```
background:    pitch-700
border:        1px solid rgba(47,45,40,0.90)
border-radius: 14px
padding:       14px
date text:     ghost-300, 12px
opponent:      ghost-100, 17px Montserrat 700
divider:       1px pitch-500
action labels: ghost-300, 11px 600, ALL CAPS, 0.06em
primary action (LOG): turq-500
delete icon:   ghost-400

Live card border: rgba(35,181,211,0.30) — visible glow
Live badge: animated dot (pulse animation), turq-500
```

### 5.12 Training cards

```
Same surface as game cards.
datetime:    ghost-300, 12px
title:       ghost-100, 17px Montserrat 700
location:    ghost-300, 12px, with map-pin icon
focus tags:  see §2.7
footer:      ghost-300 text, ghost-400 icons
Upcoming card border: rgba(35,181,211,0.25)
```

### 5.13 Player cards

```
background:    pitch-700
border:        1px solid rgba(47,45,40,0.90)
border-radius: 14px
padding:       14px
avatar:        56×56px, border-radius 50%, position-tinted bg + border (see §2.8)
name:          15px Montserrat 700, ghost-100
position:      11px Inter 600, ALL CAPS, 0.05em, position colour (see §2.8)
jersey badge:  22×22px circle, position colour bg, border 2px pitch-700
               dark text on light badges, white text on dark
edit/delete:   ghost-400 icons
```

### 5.14 Buttons

**Primary CTA:**
```
background:  linear-gradient(135deg, turq-500 #23B5D3, bell-500 #279AF1)
color:       #000000 (dark text on light gradient)
border:      none
border-radius: 12px
padding:     15px vertical
font:        14px Montserrat 700
shadow:      0 4px 24px rgba(35,181,211,0.25)
grain layer: ::after pseudo, fractalNoise SVG, opacity 0.10, mix-blend-mode overlay
```

**Secondary:**
```
background:  pitch-700
color:       ghost-300
border:      1px solid rgba(47,45,40,0.90)
border-radius: 12px
padding:     12px vertical
font:        12px Inter 500
```

**Score buttons (Live Log — our team):**
```
background:  linear-gradient(135deg, turq-500, bell-500)
color:       #000000
height:      58px
border-radius: 14px
shadow:      0 4px 20px rgba(35,181,211,0.30)
grain:       same as primary CTA
```

**Score buttons (Live Log — opponent):**
```
background:  pitch-600
color:       ghost-100
border:      1px solid pitch-400
height:      58px
border-radius: 14px
```

### 5.15 Tab bars

```
background:    pitch-800
border-bottom: 1px solid rgba(47,45,40,0.90)
active tab:    turq-500, 2px bottom border turq-500
inactive tab:  ghost-400
font:          11–12px Inter 600, ALL CAPS, 0.05em
```

**Set selector tabs (score timeline):**
```
active:   background turq-500, color #000
inactive: background pitch-600, color ghost-300
border-radius: 999px, padding 5px 11px
```

### 5.16 Live Log — court card

```
background:    pitch-700
border:        1px solid rgba(47,45,40,0.90)
border-radius: 16px

Net line:      linear-gradient(90deg, transparent, rgba(35,181,211,0.5), transparent)
               2px height, 'NET' label in turq-500

Opponent half:
  initials:    ghost-400, 32px Montserrat 800
  background:  pitch-700

Player token:
  background:  pitch-600
  border:      1.5px solid pitch-400
  border-radius: 10px
  avatar:      44×44px, border-radius 50%, position-tinted bg (see §2.8)
  serving token border: 2px turq-500, inner glow rgba(35,181,211,0.10)
  serve icon:  small turq-500 circle, top-right corner
  name:        11px Inter 600, ghost-100
  position:    9px Inter 600, ALL CAPS, position colour
  jersey badge: position colour bg, 18×18px
```

### 5.17 Live Log — icon row (Lineup / Sub / Timeout / End Set)

```
background:    pitch-700
border:        1px solid rgba(47,45,40,0.90)
border-radius: 12px
padding:       10px 6px 8px
icon:          22px, ghost-300
label:         9px Inter 600, ghost-400, ALL CAPS
active state:  turq-500 icon, rgba(35,181,211,0.12) border
active dot:    6×6px turq-500 circle, top-right corner
```

### 5.18 Hero cards (set summary + match summary)

```
background:    pitch-700
border:        1px solid rgba(47,45,40,0.90)
border-radius: 16px
radial glow:   ::before pseudo
               radial-gradient(ellipse at 50% -10%, rgba(35,181,211,0.12) 0%, transparent 65%)

Winner score:  turq-500
Loser score:   ghost-400
Separator:     ghost-400, font-weight 300
Result badge:  rb-win / rb-loss (see badge variants §2.5)
Set pips:      win = rgba(35,181,211,0.15) bg, turq-500 text
               loss = rgba(234,82,111,0.15) bg, bubb-400 text
               upcoming = pitch-600, ghost-400
               current = + border turq-500 1.5px
Set score pills (hero): won = border rgba(35,181,211,0.40)
                        lost = border rgba(234,82,111,0.35)
Meta row:      border-top pitch-500, ghost-400 text
```

### 5.19 Alert / insight cards

**Positive / coaching note:**
```
background: rgba(35,181,211,0.07)
border:     1px solid rgba(35,181,211,0.20)
icon:       turq-500
```

**Warning / action required:**
```
background: rgba(39,154,241,0.06)
border:     1px solid rgba(39,154,241,0.20)
icon:       bell-500
```

**Critical / loss pattern:**
```
background: rgba(234,82,111,0.07)
border:     1px solid rgba(234,82,111,0.22)
icon:       bubb-500
```

**AI / analysis card:**
```
background: rgba(35,181,211,0.06)
border:     1px solid rgba(47,45,40,0.90)
icon:       turq-500
```

### 5.20 Training priority rows

```
Priority 1 (critical):  badge bg rgba(234,82,111,0.15), text bubb-500
Priority 2 (warning):   badge bg rgba(39,154,241,0.12),  text bell-400
Priority 3 (maintain):  badge bg rgba(35,181,211,0.12),  text turq-500
impact value:           turq-500 / bell-500 / ghost-400 depending on severity
```

### 5.21 Auth pages (Login + Register)

The auth pages use a full-bleed gradient background — not the tonal card system.

**Login hero gradient:**
```css
background:
  radial-gradient(ellipse at 80% 10%, rgba(35,181,211,0.55) 0%, transparent 55%),
  radial-gradient(ellipse at 10% 80%, rgba(39,154,241,0.45) 0%, transparent 50%),
  radial-gradient(ellipse at 50% 50%, rgba(234,82,111,0.15) 0%, transparent 60%),
  #070600;
```

**Register hero gradient:**
```css
background:
  radial-gradient(ellipse at 90% 5%,  rgba(234,82,111,0.60) 0%, transparent 45%),
  radial-gradient(ellipse at 5%  90%, rgba(35,181,211,0.50) 0%, transparent 50%),
  radial-gradient(ellipse at 45% 50%, rgba(39,154,241,0.20) 0%, transparent 55%),
  #070600;
```

**Header grain (auth pages only — heavier):**
The gradient hero area gets an additional heavier grain at 45% opacity, same
SVG fractalNoise technique as global grain but scoped to the header element.

**Gradient text (auth headline):**
```css
background: linear-gradient(135deg, #23B5D3 0%, #279AF1 60%, #EA526F 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```

**Glass form panel:**
```css
background: rgba(22,20,18,0.70);
backdrop-filter: blur(20px);
border: 1px solid rgba(247,247,255,0.08);
border-radius: 20px;
```

**Form inputs:**
```
background:    rgba(7,6,0,0.60)
border:        1px solid pitch-400
border-radius: 10px
focus border:  rgba(35,181,211,0.50)
text:          ghost-100
placeholder:   ghost-400
icon:          ghost-400
```

**Primary CTA (auth — login):**
```
background: linear-gradient(135deg, turq-500, bell-500, rgba(234,82,111,0.8))
```

**Primary CTA (auth — register):**
```
background: linear-gradient(135deg, bubb-500, turq-500, bell-500)
shadow:     0 4px 24px rgba(234,82,111,0.30)
```

**Sport tag pill (auth):**
```
login:    turq-500 bg/border at 12%/25%, turq-500 text
register: bubb-500 bg/border at 12%/25%, bubb-500 text
```

**Role toggle (register):**
```
active:   rgba(35,181,211,0.12) bg, rgba(35,181,211,0.40) border, turq-500 text
inactive: rgba(7,6,0,0.50) bg, pitch-400 border, ghost-300 text
```

**Password strength bar segments:**
```
strong: turq-500
medium: bell-500
weak:   bubb-500
empty:  pitch-400
```

---

## 6. Season performance entry card

The dashboard season performance card uses sparklines and mini stats:

```
card background:  pitch-700, pitch-400 border
hover border:     rgba(35,181,211,0.30)
header text:      ghost-300, ALL CAPS
"Full view" link: turq-500
mini stat boxes:  pitch-600 bg, pitch-400 border
improving delta:  turq-500
flat delta:       ghost-400
declining delta:  bubb-400
weakest rotation note: bubb-400 text
```

---

## 7. Chart specifications (all charts)

Every chart must use `chartTheme` from `src/lib/chartTheme.ts`.

### Sideout % vs Break % dual line chart
```
Sideout line:   turq-500, 2px
Break line:     bell-500, 2px, strokeDasharray 4 2
SO target:      rgba(35,181,211,0.30), 1px, dashed
BP target:      rgba(39,154,241,0.30), 1px, dashed
```

### Positive play % vs Error ratio (dual axis)
```
Positive play:  bell-500, left axis, bell-500 ticks
Error ratio:    bubb-500, right axis, bubb-500 ticks
```

### Error clustering bars
```
> 0.5  (burst):   #EA526F  solid
0.2–0.5 (mild):   rgba(39,154,241,0.65)
< 0.2  (random):  #23B5D3  solid
```

### TUS timeline
```
line:            turq-500, 1.5px
fill:            rgba(35,181,211,0.12) above baseline
0.75 threshold:  rgba(234,82,111,0.30), dashed
0.55 threshold:  rgba(39,154,241,0.25), dashed
timeout markers: bell-500 vertical dashed lines
missed moments:  bubb-500 vertical dashed lines
```

### Rotation ace rate (bar chart)
```
bars: opacity-weighted turq/bell/pink based on value
strong rotation (≥25%): rgba(35,181,211,0.85)
mid rotation (15–24%):  rgba(39,154,241,0.65)
weak rotation (<15%):   rgba(234,82,111,0.45)
```

### Win/Loss trend bars
```
sets won:  turq-500, 0.8 opacity
sets lost: bubb-500, 0.7 opacity
```

### Rotation heatmap (season, multi-match grid)
```
>70%:  rgba(35,181,211,0.70)
55–70%: rgba(39,154,241,0.45)
40–55%: rgba(234,82,111,0.40)
<40%:  rgba(234,82,111,0.75)
```

### All chart axes and grids
```
grid lines:  rgba(47,45,40,0.80)
tick labels: #4A4A5A
axis border: none (display: false)
```

---

## 8. Files to create or modify

| File | Action | What changes |
|---|---|---|
| `tailwind.config.ts` | Modify | Replace colour tokens with pitch/turq/bell/bubb/ghost |
| `src/index.css` | Modify | CSS custom properties, global grain, body background |
| `src/lib/chartTheme.ts` | Create | Shared chart colour config |
| `src/components/ui/Button.tsx` | Modify | primary/secondary/score variants |
| `src/components/ui/Badge.tsx` | Modify | win/loss/warn/info/live variants |
| `src/components/ui/Card.tsx` | Modify | pitch-700 bg, correct border |
| `src/components/ui/StatTile.tsx` | Modify | KPI tile tokens |
| `src/components/ui/Input.tsx` | Modify | Auth input styling |
| `src/components/court/CourtView.tsx` | Modify | Court bg, net line colours |
| `src/components/court/PlayerToken.tsx` | Modify | Position-based colour system |
| `src/components/score/ScoreControls.tsx` | Modify | Score button gradient + opponent dark |
| `src/components/stats/TUSBar.tsx` | Modify | turq→pink gradient fill |
| `src/components/stats/RotationTable.tsx` | Modify | Four-tier cell colour system |
| `src/components/stats/DashboardCharts.tsx` | Modify | chartTheme applied |
| `src/components/stats/ErrorPressureCard.tsx` | Modify | Pink bars for errors |
| `src/components/game/GameCard.tsx` | Modify | Win/loss/live/offic colours |
| `src/components/training/TrainingCard.tsx` | Modify | Focus tag colour system |
| `src/components/players/PlayerCard.tsx` | Modify | Position colour system |
| `src/components/timeline/RallyFeed.tsx` | Modify | Dot colours by point type |
| `src/app/auth/LoginPage.tsx` | Modify | Gradient hero, glass panel |
| `src/app/auth/RegisterPage.tsx` | Modify | Pink-led gradient, role toggle |
| `src/app/dashboard/page.tsx` | Modify | Token updates throughout |
| `src/app/games/page.tsx` | Modify | Section labels, filter pills |
| `src/app/trainings/page.tsx` | Modify | Focus tags, upcoming border |
| `src/app/players/page.tsx` | Modify | Position colour system |
| `public/manifest.json` | Modify | theme_color `#23B5D3`, background_color `#000000` |

---

## 9. Acceptance criteria

Run these checks after completing the refactor. All must pass before the work
is considered done.

### 9.1 No forbidden colours

Run this grep — it must return zero matches:

```bash
grep -rn \
  "#FF5C00\|#ff5c00\|#639922\|#97C459\|#3B6D11\|#E24B4A\|#A32D2D\|#EF9F27\|#BA7517\|#00E0FF\
  \|rgba(255,92,0\|rgba(99,153,34\|rgba(59,109,17\|rgba(226,75,74\|rgba(163,45,45\
  \|rgba(186,117,23\|rgba(151,196,89\|rgba(239,159,39\
  \|text-green\|text-red\|bg-green\|bg-red\|border-green\|border-red" \
  src/ public/
```

### 9.2 No hardcoded colours outside token files

Run this — only `tailwind.config.ts` and `index.css` should appear:

```bash
grep -rn "#[0-9a-fA-F]\{6\}" src/ \
  | grep -v "tailwind.config\|index.css\|chartTheme.ts\|\.test\.\|node_modules"
```

Any hit is a violation. Move it to a token or `chartTheme.ts`.

### 9.3 Contrast ratios

Verify manually or with a contrast checker:

- `ghost-100` (`#F7F7FF`) on `pitch-700` (`#161412`) → must be ≥ 7:1
- `turq-500` (`#23B5D3`) on `pitch-700` (`#161412`) → must be ≥ 4.5:1
- `bubb-500` (`#EA526F`) on `pitch-700` (`#161412`) → must be ≥ 3:1
- Button text `#000000` on `turq-500` `#23B5D3` → must be ≥ 4.5:1

### 9.4 Chart theme usage

Every Chart.js or Recharts dataset colour must reference `chartTheme`:

```bash
grep -rn "backgroundColor:\|borderColor:\|stroke=" src/components/stats/ \
  | grep -v "chartTheme\|\.test\."
```

Zero matches expected.

### 9.5 No green or red

```bash
grep -rn "green\|red" src/components/ src/app/ \
  | grep -v "\.test\.\|//\|node_modules\|color-red\|error-red"
```

Any Tailwind class like `text-red-*`, `bg-green-*`, `border-red-*` is a violation.

### 9.6 Functional smoke test

After the refactor, verify these flows still work:

1. Login → dashboard loads with KPI tiles and charts
2. Create game → wizard steps through → saves correctly
3. Live log → score a point → court rotates → TUS updates
4. Undo last point → score reverts
5. End set → set summary appears → set up next set
6. Post-match stats → all charts render with correct palette
7. Training RSVP → player can toggle attendance
8. Analysis polling → status transitions pending → running → ready

### 9.7 PWA manifest

```bash
cat public/manifest.json | grep -E "theme_color|background_color"
```

Expected output:
```
"theme_color": "#23B5D3",
"background_color": "#000000",
```

---

## 10. What must not change

Do not touch any of the following under any circumstances:

- Routing (`/dashboard`, `/games`, `/games/[id]/log`, `/trainings`, `/players`, `/settings`)
- Zustand store logic (`matchStore`, `authStore`, `seasonStore`)
- React Query hooks, TanStack Query config, polling intervals
- TUS formula and weights
- Rotation logic (`rotate()`, `addPoint()`)
- Statistics computation (sideout %, break %, error ratio, clustering)
- Substitution and timeout business logic
- Role guards (`ManagerOnly`, `useRole`)
- API route handlers
- Prisma schema
- Docker Compose
- Service worker registration logic
- Any TypeScript interface or type definition
- Any test file
