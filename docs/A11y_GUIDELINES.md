# Accessibility Guidelines

## Baseline

Every new screen and component should target WCAG 2.1 AA for:

- keyboard access
- visible focus
- accessible names
- semantic structure
- error announcement
- contrast

## Core rules

### Interactive elements

- Use `<button>` for actions.
- Use `<a>` only for navigation.
- Never attach click behavior to plain `<div>` or `<span>` without a justified pattern and full keyboard support.

### Accessible names

- Icon-only buttons must always have `aria-label`.
- Decorative icons should use `aria-hidden="true"`.
- Inputs must have a visible `<label>` or an equivalent explicit accessible name.

### Focus

- Every focusable element must expose a visible `:focus-visible` state.
- Do not remove focus outlines without replacing them.
- Modals must trap focus and restore it on close.

### Forms

- Use `<form>` for submission areas.
- Group related controls with `<fieldset>` and `<legend>`.
- Validation errors should be connected with `aria-describedby`.
- Error messages should use `role="alert"` when immediate announcement is needed.

### Tables

- Use `<table>` only for tabular data.
- Column headers must be real `<th scope="col">`.
- Sortable columns must expose `aria-sort`.
- Provide a caption when the context is not obvious.

### Live updates

- Use `aria-live="polite"` for passive status updates.
- Use `aria-live="assertive"` only for blocking errors or urgent feedback.

### Color and contrast

- Do not rely on color alone to convey meaning.
- Pair status color with text, icon or badge label.
- Keep interactive focus and status states above WCAG AA contrast minimums.

## Component-specific guidance

### Button

- If the button only shows an icon, set `aria-label`.
- Use `title` only as a supplement, not as the sole signal.

### Modal

- Must use `role="dialog"` and `aria-modal="true"`.
- Must support `Escape`.
- Must have title and optional description linked with ARIA ids.

### Select

- Native select is preferred when search is not needed.
- Searchable select must behave like a combobox and support arrow keys, enter and escape.

### Dashboard and reporting pages

- Use `<main>` once per page.
- Use `<header>` for page introduction.
- Wrap reminder groups in a named region.

## Testing guidance

- Add `axe-core` tests for every new complex component.
- Add keyboard tests for modal, menus, tabs and custom inputs.
- When touching old screens, fix the a11y issues in the same change instead of deferring them.
