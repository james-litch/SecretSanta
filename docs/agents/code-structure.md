# Code structure

## Styling

- Use Tailwind CSS 4 utilities for component styling. Prefer the standard spacing,
  sizing, typography, and breakpoint scales (such as `p-2`, `text-sm`, and `md:`)
  over arbitrary value tokens such as `p-[.2rem]`.
- Apply utilities directly to the element being styled when its JSX is editable.
  Avoid parent descendant selectors such as `[&_a]:m-3` when `className="m-3"`
  can be placed on the link itself.
- Define reusable fluid typography in `@theme`, such as `--text-fl-xl` with
  a `clamp(...)` value, and use its `text-fl-xl` utility in components.
- Write ordinary CSS declarations using theme variables in CSS files, including
  component styles; do not use `@apply`.
- Name color tokens by palette and shade: `--color-green-dark` for dark green
  text and `--color-cream-dark` for cream borders. Use theme color utilities or
  CSS variables instead of hardcoded colors in components.
- Keep `globals.css` focused on theme variables and selectors that affect the
  whole theme, such as the default font family, alongside required imports.
- Apply heading typography, heading focus styling, and paragraph spacing directly
  to the elements with Tailwind utilities in pages and components; keep `h1`
  and `p` selectors out of global CSS.
- Component styles may live in separate CSS files imported into `globals.css`
  when they save long Tailwind class lists. Modals, disclosures, and buttons are
  examples. Keep those rules with their component rather than accumulating
  component-specific selectors in `globals.css`.
- Use the `clsx` package to combine a component's own classes with its incoming
  `className`. Allow callers to supply wrapper spacing and sizing, such as margins
  and widths.

## Components and stories

Extract components when any of these reasons applies; they are alternatives,
not a checklist that must all be satisfied:

- There is meaningful reuse.
- Extraction removes complexity from a page, such as `RoomCodeShareCard`.
- A named component improves readability, such as `Divider`.

Keep simple static paragraphs, such as the browser-access reminder, inline in
their pages or containing components. Repeating a short paragraph alone does not
justify extracting a component.

Build out components and accompanying Storybook stories for UI pieces such as
`Button`, `Disclosure`, `Logo`, `Divider`, `SprigDecoration`, `FormField`,
`Header`, and `RoomCodeShareCard`.

Co-locate each story with its React component in a component directory:

```text
Button/
  Button.tsx
  Button.stories.tsx
```

When creating or changing a component, add or update its adjacent stories to
show the relevant states and variants.

## Layouts and hooks

- Use the appropriate Next.js `layout.tsx` for shared page structure.
- Extract logic into hooks when that makes components easier to read.

## Disclosure

- Prefer native `<details>` and `<summary>` behavior. Put the fragment target's
  `id` on the relevant content inside `<details>` so the browser can reveal it
  when navigating to that fragment. Avoid duplicating native behavior with
  custom opening and hash-handling logic; verify it in supported browsers.
