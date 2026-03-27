# Accessibility Audit

## Scope

Audited areas:

- Core UI components in `src/components/ui`
- Form select component in `src/components/ui/form`
- [LoginPage.jsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/pages/LoginPage.jsx)
- [DashboardPage.jsx](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/pages/DashboardPage.jsx)

Target: WCAG 2.1 AA for the audited surfaces.

## Findings

### 1. Missing accessible names on icon-only and utility controls

Found in:

- modal close action
- icon-only button patterns
- keypad actions on login

Fix implemented:

- `Button` now infers `aria-label` from `title` for icon-only usage
- modal close button now has explicit `aria-label` and `title`
- keypad buttons now expose explicit labels like `Digito 1` and `Apagar ultimo digito`

### 2. Modal keyboard support was incomplete

Found in:

- dialog escape handling
- focus trapping and focus restore

Fix implemented:

- `Modal` now traps tab navigation
- `Escape` closes the dialog
- focus returns to the previously focused element on close

### 3. Searchable select lacked combobox semantics

Found in:

- custom searchable `Select`

Fix implemented:

- searchable select now exposes `role="combobox"`
- dropdown uses `role="listbox"`
- options use `role="option"` and `aria-selected`
- keyboard navigation with arrows, enter, escape and tab was added

### 4. Error feedback was not fully announced to screen readers

Found in:

- login PIN errors
- login auth errors
- dashboard loading errors

Fix implemented:

- error blocks now use `role="alert"`
- live regions use `aria-live="assertive"` where immediate feedback matters
- status progress for PIN entry uses `role="status"` and `aria-live="polite"`

### 5. Page semantics were weak

Found in:

- login and dashboard roots used generic containers
- dashboard filters lacked `fieldset` and `legend`
- page intro used generic wrapper

Fix implemented:

- login and dashboard now use `<main>`
- page intro now renders `<header>`
- dashboard filters now use `<form>`, `<fieldset>` and hidden `<legend>`

### 6. Focus visibility depended too much on browser defaults

Found in:

- buttons
- tabs
- sidebar links
- modal controls
- custom select

Fix implemented:

- consistent `:focus-visible` outline added for interactive controls
- checkbox and radio indicators now expose a visible focus ring

### 7. Table semantics needed strengthening

Found in:

- sortable headers
- pagination navigation
- empty states

Fix implemented:

- table supports hidden `caption`
- sortable headers expose `aria-sort`
- pagination uses `<nav>`
- empty state announces changes with `role="status"`

## Automated validation

Automated checks added in:

- [src/**tests**/accessibility.test.js](C:/Users/User/Downloads/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/nexus10-seguro-copia-2026-03-09_2036/src/__tests__/accessibility.test.js)

Coverage of tests:

- core components with `axe-core`
- modal keyboard close on `Escape`
- login page
- dashboard page

## Residual risks

- Full WCAG AA compliance for the entire product is not certified by these changes alone.
- Operational modules outside the audited surfaces still need the same pass, especially older tables and local action toolbars.
- Color contrast was reviewed at component level, but a full token-by-token contrast matrix has not yet been generated.

## Recommended next pass

1. Audit all modules under `src/modules/operations`
2. Audit navigation/sidebar with screen reader walkthrough
3. Add keyboard regression tests for custom date picker and file input
4. Run manual NVDA/VoiceOver verification on login, dashboard and modal flows
