---
name: lumo-ui-ux-pro
description: "UI/UX design intelligence tailored to the Lumo AI Website Builder. Use when designing, implementing, reviewing, or improving Lumo landing pages, dashboards, company administration, chat/editor workflows, responsive layouts, color systems, typography, accessibility, interaction feedback, forms, image placement, and Next.js/React/Tailwind interfaces."
---

# Lumo UI/UX Pro

Create polished, conversion-focused interfaces for Lumo while preserving the product's existing architecture and user data.

## Start With Context

1. Inspect the relevant route, components, data model, and existing styles before proposing changes.
2. Identify the surface: public landing page, AI editor, business dashboard, company administration, or authentication.
3. Detect the implementation stack. Prefer the project's existing Next.js/React patterns and styling approach.
4. Preserve existing behavior unless the user explicitly requests a workflow change.

For a new page or major redesign, generate a design recommendation before coding:

```bash
python scripts/search.py "AI website builder small business landing page" --design-system -p "Lumo"
```

If `python` is unavailable, use the workspace's bundled Python runtime. Run commands from this skill directory or pass the absolute path to `scripts/search.py`.

## Build a Design Contract

Before implementation, define:

- Product type, primary user, and one primary user goal
- Visual direction and explicitly avoided styles
- Semantic color tokens
- Heading and body typography
- Spacing and radius scale
- Responsive behavior
- Interaction and motion policy
- Empty, loading, success, and error states

Use the bundled search utility when evidence is helpful:

```bash
python scripts/search.py "beauty ecommerce premium trustworthy" --domain product
python scripts/search.py "conversion hero product landing" --domain landing
python scripts/search.py "accessible form validation feedback" --domain ux
python scripts/search.py "editor dashboard hierarchy" --domain web
python scripts/search.py "serif sans Vietnamese premium" --domain typography
python scripts/search.py "responsive server components images" --stack nextjs
```

Read [references/quick-reference.md](references/quick-reference.md) for implementation patterns and [references/pro-rules.md](references/pro-rules.md) for deeper delivery checks only when needed.

## Lumo Architecture Rules

- Treat the current landing-page JSON/data model as the source of truth.
- Reuse the existing renderer and section components. Do not create a parallel renderer for one design.
- Preserve chat-driven edits, section ordering, hidden sections, image drop targets, undo/redo, autosave, preview, and publishing.
- Make an edit as narrowly as the request permits. A text edit must not silently change the layout, palette, or unrelated sections.
- Map natural-language requests to explicit operations such as `update_text`, `set_style`, `hide_section`, `show_section`, `move_section`, `add_section`, or `assign_image`.
- Resolve the target before mutating. If multiple elements match, use the selected section or request clarification.
- Validate AI-produced patches before applying them. Reject unknown fields, invalid section identifiers, and fabricated asset URLs.
- Keep uploaded images in the asset tray until the user drops or assigns them to an explicit target.

## Surface Guidance

### Landing Pages

- Optimize for one primary conversion action.
- Establish a clear hierarchy: promise, proof, benefits, details, objection handling, CTA.
- Keep navigation short and anchor it to visible sections.
- Use real image placeholders or explicit drop zones; never render broken image URLs.
- Keep form length proportional to conversion value.
- Use Vietnamese-capable fonts and verify diacritics at all weights and styles.

### AI Editor

- Make selected sections, drag handles, drop zones, insertion points, and hidden states visually distinct.
- Display immediate feedback for save, upload, generation, retry, and failure.
- Never leave a permanent “AI đang cập nhật…” state after failure.
- Provide deterministic placement controls in addition to natural-language editing.
- Preserve the user's current scroll position and selection after an edit where possible.

### Dashboards and Company Admin

- Prioritize tasks over decoration: search, filter, status, ownership, date, and action.
- Use responsive tables that become readable cards or horizontal regions on narrow screens.
- Distinguish destructive actions and require confirmation for deleting projects or employees.
- Show ownership and permissions clearly. Employees must not see owner-only controls.
- Design useful empty, loading, partial-data, and error states.

## Quality Baseline

- Meet WCAG AA contrast for body text and controls.
- Support keyboard navigation and visible focus.
- Use semantic HTML and accessible labels.
- Make pointer targets at least 44 by 44 CSS pixels where practical.
- Avoid horizontal overflow at mobile widths.
- Respect `prefers-reduced-motion`; animate only to explain state or hierarchy.
- Keep typography readable with sensible line length, line height, and responsive scaling.
- Prefer SVG icons from the project's icon library over emoji or inconsistent symbols.
- Use design tokens rather than scattered literal colors and spacing values.
- Optimize images and reserve their layout space to reduce layout shift.

## Visual Direction

Favor intentional, business-appropriate design systems. Avoid:

- Generic “AI purple gradient” styling without product rationale
- Excessive glassmorphism, shadows, or rounded cards
- Decorative motion that delays core tasks
- Fixed desktop-only widths
- Tiny text and low-contrast muted text
- Unrelated redesigns caused by a small chat instruction
- Fake URLs, fake integrations, or fake success states

## Verification

Before delivery:

1. Verify the exact requested change and confirm unrelated content is intact.
2. Check desktop, tablet, and mobile layouts.
3. Test keyboard focus and primary interactive states.
4. Exercise loading, empty, success, and failure paths.
5. Run relevant tests, type checks, and build.
6. Visually inspect the rendered UI when browser tooling is available.
7. Report assumptions and remaining limitations precisely.

The bundled search data and scripts are adapted from UI UX Pro Max. See [references/source-license.md](references/source-license.md).
