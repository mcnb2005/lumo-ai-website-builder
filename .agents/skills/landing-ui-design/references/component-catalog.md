# Lumo Component Catalog

Use only these registered section types and variants. Add a renderer implementation and validation entry before introducing a new variant.

| Section | Variants |
| --- | --- |
| `hero` | `split`, `centered`, `product-showcase`, `image-background` |
| `stats` | `row`, `cards` |
| `features` | `numbered`, `grid`, `bento` |
| `pricing` | `cards`, `minimal`, `comparison` |
| `portfolio` | `grid`, `editorial`, `masonry` |
| `gallery` | `grid`, `masonry`, `showcase` |
| `testimonial` | `highlight`, `card`, `minimal` |
| `faq` | `list`, `two-columns` |
| `leadForm` | `two-columns`, `centered`, `compact` |
| `finalCta` | `minimal`, `banner` |

Typography tokens:

- Heading: `editorial`, `modern`, `friendly`.
- Body: `sans`, `humanist`.

Color decisions must use the landing palette or `sectionColors`; avoid inserting unrelated literal colors into generation prompts.
