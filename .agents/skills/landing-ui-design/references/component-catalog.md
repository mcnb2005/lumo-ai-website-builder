# Lumo Component Catalog

Use only these registered section types and variants. Add a renderer implementation and validation entry before introducing a new variant.

| Section | Variants |
| --- | --- |
| `hero` | `split`, `centered`, `product-showcase`, `image-background`, `minimal` |
| `stats` | `row`, `cards` |
| `features` | `numbered`, `grid`, `bento`, `cards`, `minimal`, `alternating` |
| `pricing` | `cards`, `minimal`, `comparison` |
| `portfolio` | `grid`, `editorial`, `masonry` |
| `gallery` | `grid`, `masonry`, `showcase` |
| `testimonial` | `highlight`, `card`, `minimal` |
| `faq` | `list`, `two-columns`, `grid` |
| `leadForm` | `two-columns`, `centered`, `compact` |
| `customBlock` | `raw` |
| `finalCta` | `minimal`, `banner`, `split` |

Semantic brief aliases are normalized before validation:

- `full-bleed` or `full-screen` hero direction maps to `image-background`; use `product-showcase` instead when the brief is specifically product/UI-demo-led.
- A `Demo` section request maps to `gallery` for a visual showcase or `portfolio` for work and case studies.

Typography tokens:

- Heading: `editorial`, `modern`, `friendly`.
- Body: `sans`, `humanist`.

Color decisions must use the landing palette or `sectionColors`; avoid inserting unrelated literal colors into generation prompts.
