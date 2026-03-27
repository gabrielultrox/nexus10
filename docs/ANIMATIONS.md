# Animations

## Goals

- Motion must feel responsive and not decorative by default.
- All transitions stay at or below `280ms`.
- The preferred path is CSS-only, GPU-friendly and low layout cost.

## Global motion tokens

Defined in:

- [src/styles/transitions.css](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/styles/transitions.css)

Available tokens:

- `--motion-duration-fast`
- `--motion-duration-normal`
- `--motion-duration-slow`
- `--motion-ease-standard`
- `--motion-ease-emphasized`
- `--motion-ease-press`
- `--motion-ease-exit`

## Reusable classes

- `.motion-fade-enter`
- `.motion-slide-up-enter`
- `.motion-scale-enter`
- `.motion-shake`
- `.motion-pulse`
- `.motion-spinner`
- `.motion-route-stage`
- `.motion-dots`

## Implemented surfaces

### Modal

- enter with scale + fade
- exit with short scale-out
- backdrop fade

### Toast

- appear/disappear with translate + fade
- error toasts shake
- success toasts fade in cleanly

### Buttons, checkbox, radio

- button press effect uses scale on active
- checkbox and radio indicators animate on selection

### Dropdowns

- searchable select dropdown animates on open
- close uses short opacity/translate exit

### Pagination

- table page changes apply a short slide/fade on tbody

### Loading

- `Skeleton` component for shimmer placeholders
- `RouteLoader` now uses skeletons instead of static text

## Route transitions

Route-level polish is handled in:

- [src/App.jsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/App.jsx)

Approach:

- React 18 `useTransition` is used to schedule the visual route key update
- CSS handles the fade/translate entrance
- navigation is not blocked by JS animation logic

## Performance rules

- Animate only `opacity` and `transform`
- Avoid animating layout-heavy properties
- Keep durations below `300ms`
- Respect `prefers-reduced-motion`
