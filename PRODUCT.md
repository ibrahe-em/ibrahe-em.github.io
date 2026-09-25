# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: prospective clients.** Businesses deciding whether to hire Muhammad Ibrahim to build software for them. They come to judge whether he can take a problem and ship a finished, customer-facing product.
- **Secondary: recruiters and hiring managers** evaluating him for internships.

Most visitors arrive from a pasted link (a DM, an email, a CV) and scan quickly before deciding whether to open a project.

## Product Purpose

A personal portfolio for Muhammad Ibrahim, a CS student and AI/ML developer. It shows real, shipped work so that a client or recruiter can see what he builds and how he thinks, and then get in touch.

Success means a visitor understands what he can build for them and reaches out. He is currently open to **freelance/client work** and **internships**.

## Positioning

"I build AI-powered software that solves real business problems." The claim is backed by delivered client products, not only coursework: True Momentum (a product built around an existing AI pipeline), Auspec Pharma (a public site plus an admin system with QR-linked medicine leaflets), and House of Lawn (a Shopify catalog of about 1,000 products). Alongside those sit independent products with real users, such as FlexPlus, which reached about 1,000 students.

## Operating Context

- Visitors reach the site through shared links, often on mobile. That is why the mobile pass and asset compression were already done.
- Each project shows as a card that opens a modal with sections for problem, solution, stack, and screenshots.
- Projects are either `client` or `personal` work (`kind` in `data/projects.json`).
- Contact options are in the footer: GitHub, LinkedIn, Hugging Face, a CV on Google Drive, and email.
- Umami analytics is installed.

## Capabilities and Constraints

- **Data-driven projects (binding).** Projects live in `data/projects.json` and the site renders from that file. New project content goes through the data file, not hand-written markup.
- Feature flags live in `js/config.js`, including project tabs, the media base, and the default pattern and zoom.
- Screenshots come from Cloudinary, with repo paths as a fallback.
- The site is currently static HTML/CSS/JS with no build step, hosted on GitHub Pages. The user chose not to make "no build step" binding, so this is the current state rather than a permanent commitment.
- **Undecided:**
  - A custom domain.
  - A self-hosted CV.
  - An About section with a photo.
  - A primary contact CTA.
  - Per-project outcome/results blocks.
  - An interactive "lab" section.

  These are all backlog items in `todo.txt`.

## Brand Commitments

- **Playful personality (binding).** The cat image with its click counter, the Konami-code wobble, and the live PKT clock are part of the site's identity. Future work keeps them and may make them easier to find, but does not remove them.
- The voice is first person, plain, and concrete. Problem/solution copy describes what was actually built and why, without hype.

## Evidence on Hand

- **Projects with real screenshots:**
  - True Momentum (`homepage`)
  - Auspec Pharma (`auspec-home`)
  - FlexPlus (`template`)
  - MailMind (`mailmind-home`)
- **Projects with placeholder screenshots only** (`assets/projects-optimized/generic.webp`):
  - Sepsis Analysis
  - Lookbook Cropper
  - House of Lawn
  - One of True Momentum's slots
- **Live links:** True Momentum, Auspec Pharma, House of Lawn, and the MailMind demo.
- **Real metrics:** FlexPlus has about 1,000 users, and House of Lawn has a catalog of about 1,000 products.
- **Absent (do not fabricate):**
  - Testimonials or client quotes
  - Model accuracy or F1 scores
  - Time-saved figures
  - User counts other than FlexPlus's
  - A personal photo
  - Education details beyond "CS student"

## Product Principles

1. **Clients first, recruiters close behind.** Lead with evidence that he can deliver a finished product for a business. Internship-relevant depth, such as the ML work, supports that story.
2. **Show, don't claim.** Real screenshots, live links, and honest numbers outrank adjectives. If something isn't real yet, it stays off the page.
3. **Personality is a feature.** The playful details make the site memorable. Keep them without letting them get in the way of evaluating the work.
4. **Content lives in data.** Projects and their details come from `data/projects.json`, so adding or updating work never means redesigning the page.
