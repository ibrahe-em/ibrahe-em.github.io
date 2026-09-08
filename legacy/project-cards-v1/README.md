# Project cards — v1 (archived)

The original "folder tab" project cards, kept verbatim after the site moved to
the v2 card design (`export/ProjectCard.jsx`).

Nothing in this directory is loaded by the site — it is a reference copy so the
old design can be read or restored.

| File | Came from | What it is |
| --- | --- | --- |
| `cards.css` | `css/styles.css` | `.projects-grid`, `.project-card` and everything under it, plus the hover and responsive rules that lived in other blocks of the stylesheet. |
| `cards.js` | `js/main.js` | `renderProjects()` — the markup for a v1 card and its click/keyboard wiring. |

## What the v1 card looked like

- A manila-folder shape: square-ish corners, a small tab drawn with `::after`,
  `--project-accent` on the border while pressed.
- Text only — title row (with a small pill "Live ↗" link), tagline, description
  and pill-shaped tags. No screenshot.
- The whole body was one `role="button"` that opened the detail modal.

## To restore

Paste `cards.css` back into `css/styles.css` in place of the `/* ---------- project
cards ---------- */` block (dropping the "companion rules" section into the
hover-states and responsive blocks it came from), and paste `cards.js` back over
`renderProjects()` in `js/main.js`. Both depend on `--project-card-min`, which the
v2 cards no longer define.
