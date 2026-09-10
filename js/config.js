/* ============================================================
   Muhammad Ibrahim — portfolio
   Feature flags.

   The site has no build step, so this stands in for an env file: a plain
   script loaded before main.js, read synchronously, edited by hand. Flip a
   value, save, reload — nothing to compile and nothing to install.

   Every flag defaults to ON. A missing key, or a missing file altogether,
   leaves the site whole rather than silently stripping parts out of it.
   ============================================================ */

window.SITE_CONFIG = {
  /* The Personal / Client filter above the project grid.
     false — every project renders in one grid, the control disappears, and a
     ?tab= in the URL is ignored. The show-more fold is unaffected either way. */
  projectTabs: false,

  /* Where project screenshots are delivered from. A "screenshots" entry in
     projects.json that is not a repo path and not a full URL is treated as a
     Cloudinary public id and hung off this base, with the size asked for in
     the URL — one upload, a card rendition and a modal rendition.

     "" — no delivery base: every entry is read as a path in this repo, which
     is how the site ran before any of this and how it runs if the account
     ever goes away. */
  mediaBase: "https://res.cloudinary.com/oswyubh6/image/upload",

  /* The swirl that washes in behind a project screenshot on hover, for every
     project that does not name its own "pattern" in data/projects.json.
     Generate one with scripts/swirl.py — a bright swirl on a near-black
     background, which is what the script's defaults produce, since the card
     reads the image's own brightness to decide what stays and what drops out.
     "" — no default: only projects with their own pattern get a wash. */
  projectPattern: "assets/patterns/default.png",

  /* How close a card sits to its pattern. 1 is the pattern scaled to just
     cover the preview — as much of the render as a card of that shape can
     show; 2 is twice as close, over a quarter of the area. A project can set
     its own with "patternZoom" in data/projects.json.

     1 is the floor, and cards clamp to it: below that the pattern stops
     reaching the edges of the preview and the wash tears off them. If a swirl
     reads too coarse at 1, the fix is a finer render — swirl.py --scale — not
     a smaller one. */
  projectPatternZoom: 1,
};
