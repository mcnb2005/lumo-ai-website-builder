# Lumo Landing Schema

The canonical page model is `LandingData` in `app/landing-data.ts`. The multi-step creation pipeline compiles it through `LandingProject` in `app/landing-project.ts`.

## Required Structure

- `design`: template id/version, registered section variants, and typography tokens.
- Core copy: brand, Hero copy, CTAs, proof, section headings, and final CTA copy.
- Collections: stats, features, pricing, portfolio, gallery, testimonial, FAQ, and lead form.
- Assets: Hero, portfolio, and gallery URLs plus fit/position metadata.
- Layout: `sectionOrder`, `hiddenSections`, and optional `sectionColors`.
- Palette tokens: `ink`, `paper`, `accent`, `soft`, and `line`.

## Invariants

- Normalize all landing data before rendering or persistence.
- Keep every supported section in `sectionOrder`; use `hiddenSections` for visibility.
- Never hide `finalCta` through AI operations.
- Preserve internal asset URLs unless the user explicitly assigns or removes an asset.
- Validate all AI output as a typed draft or operation envelope before application.
- Use `LandingProject.brief`, `blueprint`, `content`, `design`, and `assets` to separate planning from rendering.
