---
name: landing-ui-design
description: Design, implement, or review Lumo landing templates and AI generation flows that use LandingData, LandingProject, section variants, design tokens, and the controlled component catalog. Use for template structure, builder prompts, responsive behavior, visual differentiation, conversion hierarchy, or landing UI quality work.
---

# Landing UI Design

Build Lumo landing pages as controlled data and registered variants. Preserve the existing renderer and schema instead of generating arbitrary HTML, CSS, or React.

## Workflow

1. Read the relevant schema, template registry, renderer, and operation validation before editing.
2. Identify the business goal, audience, primary CTA, and one deliberate aesthetic direction.
3. Choose a conversion journey and section order that fits the page purpose.
4. Select only registered section types and variants from the component catalog.
5. Express visual choices through the existing typography, palette, section color, image, and variant fields.
6. Verify desktop, tablet, and mobile behavior in the existing renderer.
7. Validate generated data and operations before applying them.

## Controlled Generation

- Keep AI output inside `LandingData`, `LandingProject`, `SectionDraft`, `BuilderPlan`, or validated landing operations.
- Do not ask the model to emit free-form HTML, CSS, JSX, React components, scripts, or unregistered component names.
- Preserve internal asset URLs. Never fabricate image URLs or leave image-dependent layouts visibly broken when no image exists.
- Keep one primary conversion action across Hero, forms, pricing, and final CTA.
- Use deterministic code for schema validation, permissions, persistence, uploads, publishing, and operation application.

## Template Differentiation

- Give each template family a recognizable content journey, not merely a different palette.
- Vary section order, visible sections, hero composition, density, typography, image emphasis, and CTA placement with purpose.
- Avoid forcing every page through the same Hero, Stats, Features, Pricing, Testimonial, FAQ sequence.
- Keep `hero` at the beginning and `finalCta` at the end of generated blueprints unless the product explicitly supports another invariant.
- Prefer fewer purposeful sections over a long generic page.

## Responsive And Quality Rules

- Use project design tokens and registered variants; do not introduce arbitrary parallel styling systems.
- Keep text readable and controls reachable at desktop, tablet, and mobile sizes.
- Prevent overflow, overlapping content, layout shifts, empty media frames, and clipped button labels.
- Maintain heading hierarchy, visible focus states, useful alt text, and sufficient color contrast.
- Run focused tests for schema/registry changes and visually inspect affected templates when renderer behavior changes.

## References

- Read [references/landing-schema.md](references/landing-schema.md) when changing AI output or validation.
- Read [references/component-catalog.md](references/component-catalog.md) when choosing section variants.
- Read [references/template-structures.md](references/template-structures.md) when adding or differentiating templates.
