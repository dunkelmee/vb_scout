---
name: Kinetic Court
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#e4beb1'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#ab897d'
  outline-variant: '#5b4137'
  surface-tint: '#ffb59a'
  primary: '#ffb59a'
  on-primary: '#5a1b00'
  primary-container: '#ff5c00'
  on-primary-container: '#521800'
  inverse-primary: '#a73a00'
  secondary: '#b9f1ff'
  on-secondary: '#00363f'
  secondary-container: '#00e0ff'
  on-secondary-container: '#005f6d'
  tertiary: '#c1c6da'
  on-tertiary: '#2b3040'
  tertiary-container: '#8d92a5'
  on-tertiary-container: '#262b3b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb59a'
  on-primary-fixed: '#370e00'
  on-primary-fixed-variant: '#802a00'
  secondary-fixed: '#a5eeff'
  secondary-fixed-dim: '#00daf8'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#004e5a'
  tertiary-fixed: '#dee2f7'
  tertiary-fixed-dim: '#c1c6da'
  on-tertiary-fixed: '#161b2a'
  on-tertiary-fixed-variant: '#414657'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  display-lg:
    fontFamily: Montserrat
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Montserrat
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-bold:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
  stat-value:
    fontFamily: Montserrat
    fontSize: 22px
    fontWeight: '800'
    lineHeight: 28px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  gutter: 12px
---

## Brand & Style
The design system is engineered for the high-velocity world of competitive volleyball. It targets a youthful demographic of athletes and coaches, evoking a sense of momentum, precision, and peak performance. 

The aesthetic is **Modern Athletic**, blending the high-energy visuals of professional sports broadcasting with contemporary digital refinement. This is achieved through a mix of **Glassmorphism** for premium data overlays and a **High-Contrast** approach to highlight critical performance metrics. The UI should feel fast, responsive, and tactile, mirroring the physical nature of the sport.

## Colors
The palette is anchored in a high-contrast dark mode to make performance data and vibrant accents "pop." 

- **Spike Orange (#FF5C00):** The primary driver for actions and highlights. It represents energy and the point of contact.
- **Electric Blue (#00E0FF):** Used for secondary metrics, active states, and motion-based accents.
- **Athletic Navy (#1A1F2E):** The foundational surface color, providing a deep, professional backdrop that reduces eye strain during heavy data review.
- **Crisp White (#F8FAFC):** Reserved for high-priority typography and icons to ensure maximum legibility against dark surfaces.

Gradients should be used sparingly on primary buttons and progress indicators to suggest directional movement.

## Typography
Typography is split between **Montserrat** for impactful, "punchy" headings and **Inter** for dense data visualization and body text. 

- **Headings:** Use Heavy (800) or Bold (700) weights. Slightly negative letter-spacing on larger sizes creates a tighter, more aggressive athletic look.
- **Body:** Inter is utilized for its exceptional legibility in mobile interfaces.
- **Stats:** A specific `stat-value` style is defined using Montserrat with increased letter-spacing to ensure numbers are easily distinguishable during fast-paced play review.

## Layout & Spacing
This design system utilizes a **fluid grid** optimized for mobile-first interaction. 

- **Grid:** A 4-column grid for mobile with 20px side margins. 
- **Rhythm:** An 8pt spatial system is used for vertical rhythm, while 4px increments are used for fine-tuned component internal spacing.
- **Density:** High information density is permitted for stat tables, but generous padding (24px+) must surround primary CTA areas to prevent "fat-finger" errors during intense match management.

## Elevation & Depth
Depth is signaled through **Tonal Layering** and **Glassmorphism**, rather than traditional heavy shadows.

- **Level 0 (Base):** Athletic Navy (#1A1F2E).
- **Level 1 (Cards):** A slightly lighter navy tint (#252A3D) with a subtle 1px inner border (10% opacity white) to define edges.
- **Level 2 (Overlays):** Glassmorphic surfaces using a backdrop filter (blur: 12px) and 60% opacity of the secondary color for modals or floating stat panels.
- **Shadows:** Use "Ambient Glows" instead of black shadows. For example, a Spike Orange button should have a soft, low-opacity orange drop shadow to simulate energy emission.

## Shapes
The shape language is **Rounded (0.5rem base)**. 

- **Standard Elements:** Buttons, cards, and input fields use an 8px (0.5rem) radius.
- **Data Containers:** Smaller chips for "Player Position" or "Status" use a full pill-shape (rounded-xl) to distinguish them from interactive buttons.
- **Visual Flourishes:** Use 45-degree angled "sheared" corners occasionally on decorative elements or headers to reinforce the feeling of speed and forward motion.

## Components
- **Action Buttons:** Use the `action-power` gradient. Typography should be uppercase `label-bold`. Buttons must have a minimum height of 48px.
- **Player Cards:** Level 1 elevation cards. Top section features a large player photo, with a bottom glassmorphic strip containing the `stat-value` metrics (Kills, Blocks, Aces).
- **Glass Chips:** Semi-transparent containers for tags. Use 10% white fill with a 20% white border and 12px blur.
- **Bottom Navigation:** A fixed, blurred glass bar. The active icon uses the Spike Orange color with a small dot indicator below it.
- **Stat Inputs:** Large, clear input fields with a "stepper" (+/-) design for easy score and stat tracking during live games.
- **Match Results:** A split-card design showing team colors, with the winning score highlighted using the Electric Blue accent.