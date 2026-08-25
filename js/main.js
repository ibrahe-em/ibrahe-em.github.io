/* ============================================================
   Muhammad Ibrahim — portfolio
   Vanilla JS only. No frameworks, no build step.
   Responsibilities:
     1. Fetch data/projects.json and render project cards
     2. Page progress indicator
     3. Cursor-aware image tilt
     4. Cat image click counter
     5. Professional greeting rotation
     6. Footer live clock (PKT)
     7. IntersectionObserver for card entrance
     8. Konami easter egg
   ============================================================ */

(function () {
  "use strict";

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);

  /* ---------- theme toggle ---------- */

  const themeToggle = $("#themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      let currentTheme = document.documentElement.getAttribute("data-theme");

      if (!currentTheme) {
        const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        currentTheme = isSystemDark ? "dark" : "light";
      }

      const newTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);

      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", newTheme === "dark" ? "#141210" : "#f5efe6");
    });
  }

  /* ---------- professional greeting rotation ---------- */

  const greetings = [
    "Hi there, I'm",
    "Hello, I'm",
    "Hey there, I'm",
    "Welcome — I'm",
    "Good to see you, I'm",
  ];

  const greetingEl = $("#introGreeting");
  if (greetingEl) {
    greetingEl.textContent = greetings[Math.floor(Math.random() * greetings.length)];
  }

  /* ---------- fetch & render projects ---------- */

  fetch("data/projects.json")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load project data");
      return res.json();
    })
    .then((data) => {
      const normalized = normalizeProjectData(data);
      renderSectionHeading(normalized.projectsSection, "#workIndex", "#workHeading");
      renderProjects(normalized.projects);
      renderTabs(normalized.projects);
      observeCards();
    })
    .catch((err) => {
      console.error(err);
      $("#projectList").innerHTML =
        '<li class="noscript-note">Could not load project data. See github.com/mibrahimfiftysix.</li>';
    });

  function renderSectionHeading(section, indexSel, headingSel) {
    if (!section) return;
    $(headingSel).innerHTML = `${section.heading} <em>${section.headingAccent}</em>`;
  }

  function normalizeProjectData(data) {
    if (Array.isArray(data)) {
      return {
        projectsSection: {
          sectionLabel: "Selected work",
          heading: "Projects I have",
          headingAccent: "Built."
        },
        projects: Array.isArray(data[0]) ? data[0] : data
      };
    }

    if (data && Array.isArray(data.projects)) {
      return data;
    }

    return {
      projectsSection: {
        sectionLabel: "Selected work",
        heading: "My",
        headingAccent: "Projects."
      },
      projects: []
    };
  }

  /* ---------- store projects for modal ---------- */
  let allProjects = [];

  function renderProjects(projects) {
    allProjects = projects;
    const list = $("#projectList");
    list.innerHTML = projects
      .map((p, i) => {
        const featuredClass = p.featured ? " featured" : "";
        const ongoingClass = p.ongoing ? " ongoing" : "";
        return `
        <li class="project-card${featuredClass}${ongoingClass}" style="--project-accent:${p.accent}; --card-i:${i}; view-transition-name:card-${p.id};" data-project-id="${p.id}" data-kind="${kindOf(p)}">
          <div class="project-link" role="button" tabindex="0" aria-label="View ${p.title} details">
            <div class="project-title-row">
              <h3 class="project-title">${p.title}</h3>
              ${p.deployed_url ? `<a class="card-demo-link" href="${p.deployed_url}" target="_blank" rel="noopener noreferrer" aria-label="Live demo" title="Live demo">Live <span aria-hidden="true">↗</span></a>` : ''}
            </div>
            <p class="project-tagline">${p.tagline}</p>
            <p class="project-desc">${p.description}</p>
            
            <ul class="project-tags">
              ${p.tags.map((t) => `<li>${t}</li>`).join("")}
            </ul>
          </div>
          ${p.ongoing ? '<div class="project-overlay" role="status" aria-label="In progress"><span class="overlay-badge">In progress</span></div>' : ''}
        </li>`;
      })
      .join("");

    // Attach click handlers to each card
    list.querySelectorAll(".project-card").forEach((card) => {
      const link = card.querySelector(".project-link");
      if (!link) return;

      // Don't let demo link clicks open the modal
      card.querySelectorAll(".card-demo-link").forEach((link) => {
        link.addEventListener("click", (e) => e.stopPropagation());
      });

      function openCard(e) {
        // Don't open modal for ongoing projects
        if (card.classList.contains("ongoing")) return;
        // Don't open modal when clicking demo link
        if (e.target.closest(".card-demo-link")) return;
        e.preventDefault();
        const id = card.dataset.projectId;
        const project = allProjects.find((p) => p.id === id);
        if (project) openModal(project);
      }

      link.addEventListener("click", openCard);
      link.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCard(e);
        }
      });
    });
  }

  /* ---------- work tabs ---------- */

  /* Display order and labels. A kind absent from the data never gets a tab, so
     this list can name buckets before any project uses them. */
  const KIND_TABS = [
    { id: "personal", label: "Personal" },
    { id: "client", label: "Client" },
  ];
  const DEFAULT_KIND = "personal";
  const ALL = "all";
  const TAB_PARAM = "tab";

  // Older entries predate the field; treating a missing kind as personal means
  // the data file never has to be backfilled for the filter to work.
  function kindOf(project) {
    return project.kind || DEFAULT_KIND;
  }

  function renderTabs(projects) {
    const bar = $("#workTabs");
    if (!bar) return;

    const counts = projects.reduce((acc, p) => {
      const k = kindOf(p);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    const present = KIND_TABS.filter((t) => counts[t.id]);

    // One bucket is not a choice — leaving the bar empty hides it via :empty.
    if (present.length < 2) {
      bar.innerHTML = "";
      return;
    }

    const tabs = [{ id: ALL, label: "All", count: projects.length }].concat(
      present.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))
    );

    bar.innerHTML = tabs
      .map(
        (t) => `
        <button type="button" class="work-tab" data-kind="${t.id}" aria-pressed="false">
          ${t.label}<span class="work-tab-count" aria-hidden="true">${String(t.count).padStart(2, "0")}</span>
        </button>`
      )
      .join("");

    const indicator = document.createElement("span");
    indicator.className = "work-tabs-indicator is-initial";
    indicator.setAttribute("aria-hidden", "true");
    bar.appendChild(indicator);

    bar.querySelectorAll(".work-tab").forEach((btn) => {
      btn.addEventListener("click", () => applyFilter(btn.dataset.kind, true));
    });

    const requested = new URL(window.location.href).searchParams.get(TAB_PARAM);
    const initial = tabs.some((t) => t.id === requested) ? requested : ALL;
    // Page load has no previous state to morph from, and routing it through a
    // transition would defer the marker's first placement into a callback.
    applyFilter(initial, false, false);

    // Drop the suppressor only once the browser has painted the marker where it
    // belongs, otherwise it visibly slides in from the left on first load.
    requestAnimationFrame(() => indicator.classList.remove("is-initial"));

    // The marker is positioned in pixels, so a resize invalidates it. Measuring
    // is cheap, but doing it on every resize event is not.
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(moveIndicator, 120);
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* Reads two layout properties and writes two custom properties — no per-frame
     JavaScript. The move itself is a transform, so it stays on the compositor. */
  function moveIndicator() {
    const bar = $("#workTabs");
    const indicator = bar && bar.querySelector(".work-tabs-indicator");
    const active = bar && bar.querySelector('.work-tab[aria-pressed="true"]');
    if (!indicator || !active) return;
    indicator.style.setProperty("--ind-x", `${active.offsetLeft}px`);
    indicator.style.setProperty("--ind-w", String(active.offsetWidth));
  }

  function applyFilter(kind, updateUrl, animate = true) {
    const commit = () => {
      document.querySelectorAll("#workTabs .work-tab").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.kind === kind));
      });

      // Toggling a class rather than re-rendering keeps every card's click and
      // keyboard handler attached — a re-render would have to rebind them all.
      document.querySelectorAll("#projectList .project-card").forEach((card) => {
        const show = kind === ALL || card.dataset.kind === kind;
        card.classList.toggle("is-hidden", !show);
      });

      moveIndicator();
    };

    // View transitions let the browser tween the two layouts itself, on the
    // compositor. Where the API is missing the swap is simply instant, and
    // reduced-motion opts out on purpose rather than by accident.
    if (animate && document.startViewTransition && !prefersReducedMotion()) {
      document.startViewTransition(commit);
    } else {
      commit();
    }

    if (!updateUrl) return;
    // replaceState, not pushState: the address bar stays shareable without
    // turning every tab click into a browser-back step.
    const url = new URL(window.location.href);
    if (kind === ALL) url.searchParams.delete(TAB_PARAM);
    else url.searchParams.set(TAB_PARAM, kind);
    window.history.replaceState(null, "", url);
  }

  /* ---------- github contributions ---------- */

  /* Path B: read straight from a CORS-enabled proxy at page load. GitHub's own
     /users/<name>/contributions fragment carries no Access-Control-Allow-Origin
     header, so the browser cannot read it directly and this stands in for it.
     The site repo lives under a different account than the contributions do —
     this name is deliberate, not derivable from the repo. */
  const GH_USER = "maybethemuhammadibrahim";
  const GH_API = `https://github-contributions-api.jogruber.de/v4/${GH_USER}?y=last`;

  const CELL = 11;          // square edge
  const GAP = 3;
  const STEP = CELL + GAP;
  const DAY_LABEL_W = 26;   // gutter for Mon/Wed/Fri
  const MONTH_LABEL_H = 14;
  const MIN_WEEKS = 12;
  const MAX_WEEKS = 53;

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                       "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let contribDays = null;   // flat, chronological, from the API
  let contribWeeksShown = 0;

  function initContributions() {
    fetch(GH_API)
      .then((res) => {
        if (!res.ok) throw new Error(`contributions API ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const days = (data && data.contributions) || [];
        // A well-formed but empty year is still nothing worth drawing.
        if (!days.length || !days.some((d) => d.count > 0)) return;
        contribDays = days;
        // Reveal before rendering: a hidden section is display:none, so its
        // clientWidth reads 0 and every width would collapse to the floor.
        $("#contrib").hidden = false;
        renderContributions();

        let timer;
        window.addEventListener("resize", () => {
          clearTimeout(timer);
          timer = setTimeout(renderContributions, 150);
        });
      })
      .catch(() => {
        /* Deliberately silent. The section was authored hidden, so a dead or
           rate-limited upstream simply leaves the page as if it never existed
           rather than showing a broken frame. */
      });
  }

  /* How many weeks fit at this width. Rather than scaling the squares down to
     an unreadable size on a phone, the window shortens and the cells stay 11px. */
  function weeksThatFit(containerWidth) {
    const usable = containerWidth - DAY_LABEL_W;
    const fits = Math.floor((usable + GAP) / STEP);
    return Math.max(MIN_WEEKS, Math.min(MAX_WEEKS, fits));
  }

  function renderContributions() {
    const host = $("#contribChart");
    if (!host || !contribDays) return;

    // clientWidth counts the element's own horizontal padding, which here is a
    // full --pad gutter each side. Budgeting against it would size the grid to
    // the padding box and let max-width squeeze the squares below 11px.
    const cs = window.getComputedStyle(host);
    const usable = host.clientWidth
      - parseFloat(cs.paddingLeft || 0)
      - parseFloat(cs.paddingRight || 0);
    const weeks = weeksThatFit(usable);
    // Re-rendering identical output on every resize tick is pure waste.
    if (weeks === contribWeeksShown && host.querySelector(".contrib-svg")) return;
    contribWeeksShown = weeks;

    // The API returns whole weeks starting on a Sunday; trim from the left so
    // the grid keeps its day-of-week rows and the most recent week stays last.
    const cols = [];
    for (let i = 0; i < contribDays.length; i += 7) {
      cols.push(contribDays.slice(i, i + 7));
    }
    const shown = cols.slice(-weeks);

    const w = DAY_LABEL_W + shown.length * STEP - GAP;
    const h = MONTH_LABEL_H + 7 * STEP - GAP;

    let cells = "";
    let months = "";
    let lastMonth = -1;

    shown.forEach((col, x) => {
      const cx = DAY_LABEL_W + x * STEP;
      col.forEach((day, y) => {
        const d = new Date(day.date + "T00:00:00");
        // Label a month the first time one of its columns appears, but not in
        // the final column where the text would overhang the chart.
        if (y === 0 && d.getMonth() !== lastMonth && x < shown.length - 2) {
          lastMonth = d.getMonth();
          months += `<text class="contrib-axis" x="${cx}" y="9">${MONTH_NAMES[d.getMonth()]}</text>`;
        }
        const label = `${day.count === 0 ? "No" : day.count} contribution${day.count === 1 ? "" : "s"} on ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        cells += `<rect class="contrib-cell" x="${cx}" y="${MONTH_LABEL_H + y * STEP}" ` +
                 `width="${CELL}" height="${CELL}" fill="var(--gh-${day.level})">` +
                 `<title>${label}</title></rect>`;
      });
    });

    // Mon/Wed/Fri only — labelling all seven crowds the gutter, and these three
    // are enough to orient the rows.
    let dayLabels = "";
    [1, 3, 5].forEach((y) => {
      dayLabels += `<text class="contrib-axis" x="0" y="${MONTH_LABEL_H + y * STEP + CELL - 2}">${DAY_NAMES[y]}</text>`;
    });

    const total = contribDays.reduce((n, d) => n + d.count, 0);
    const summary = `${total} GitHub contributions in the last year`;

    host.innerHTML =
      `<svg class="contrib-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ` +
      `role="img" aria-label="${summary}">${months}${dayLabels}${cells}</svg>` +
      `<p class="contrib-legend"><span>Less</span>` +
      [0, 1, 2, 3, 4].map((l) =>
        `<span class="contrib-legend-swatch" style="background:var(--gh-${l})"></span>`
      ).join("") +
      `<span>More</span></p>`;

    const totalEl = $("#contribTotal");
    if (totalEl) totalEl.textContent = `${total} contributions · last 12 months`;
  }

  /* ---------- modal system ---------- */

  const modalOverlay = $("#modalOverlay");
  const modalContent = $("#modalContent");

  // Simple icon map — no external dependencies
  const stackIcons = {
    python: "🐍", react: "⚛️", fastapi: "⚡", gmail: "✉️",
    openai: "🤖", postgresql: "🐘", javascript: "JS", html: "◇",
    css: "◆", chrome: "🌐", dom: "🔗", scikitlearn: "📊",
    pandas: "🐼", numpy: "🔢", xgboost: "🚀", flask: "🧪",
    sqlite: "💾", celery: "🥬", opencv: "👁️"
  };

  function openModal(project) {
    const d = project.detail;
    if (!d) return;

    /*
     * To use your own screenshots, place images in:
     *   assets/projects/[project.id]/screenshot-1.webp
     * Then update "screenshots" in projects.json with local paths.
     */

    const albumHTML = d.screenshots
      .map((src, i) => `<img class="album-photo" data-pos="${i}" src="${src}" alt="${project.title} screenshot ${i + 1}" loading="lazy">`)
      .join("");

    const stackHTML = d.stack
      .map((tool) => {
        const icon = stackIcons[tool.icon] || "•";
        return `<span class="stack-item"><span class="stack-icon">${icon}</span>${tool.name}</span>`;
      })
      .join("");

    modalContent.innerHTML = `
      <div class="modal-sticky-head">
      <div class="sheet-handle" aria-hidden="true"></div>
      <div class="modal-header">
        <div class="modal-header-left">
          <h2 class="modal-title">${project.title}</h2>
          <p class="modal-tagline">${project.tagline}</p>
        </div>
        <div class="modal-header-actions">
          ${project.deployed_url ? `
          <a class="modal-link modal-link-demo" href="${project.deployed_url}" target="_blank" rel="noopener noreferrer" aria-label="View live demo">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
            <span>Demo</span>
          </a>` : ''}
          <a class="modal-link" href="${project.url}" target="_blank" rel="noopener noreferrer" aria-label="View on GitHub">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.81.5 12.38c0 5.26 3.39 9.72 8.09 11.29.59.11.81-.26.81-.58v-2.02c-3.29.74-3.98-1.39-3.98-1.39-.54-1.42-1.32-1.8-1.32-1.8-1.08-.76.08-.75.08-.75 1.2.09 1.83 1.28 1.83 1.28 1.06 1.88 2.77 1.34 3.45 1.03.11-.79.42-1.34.76-1.65-2.63-.31-5.39-1.36-5.39-6.06 0-1.34.46-2.44 1.22-3.3-.12-.31-.53-1.56.12-3.24 0 0 .99-.33 3.24 1.26a11.02 11.02 0 0 1 5.9 0c2.24-1.59 3.23-1.26 3.23-1.26.65 1.68.24 2.93.12 3.24.76.86 1.22 1.96 1.22 3.3 0 4.71-2.77 5.74-5.41 6.05.43.39.81 1.16.81 2.34v3.47c0 .32.22.7.82.58 4.7-1.57 8.08-6.03 8.08-11.29C23.5 5.81 18.35.5 12 .5Z"/></svg>
            <span>GitHub</span>
          </a>
          <button class="modal-close" id="modalClose" aria-label="Close modal">×</button>
        </div>
      </div>
      </div>

      <div class="bento-grid">
        <div class="bento-cell bento-album">
          <p class="bento-label">Screenshots</p>
          <div class="album-stack" id="albumStack">
            ${albumHTML}
          </div>
          <div class="album-dots" id="albumDots" role="tablist" aria-label="Screenshot navigation"></div>
          <p class="album-hint" id="albumHint"></p>
        </div>

        <div class="bento-cell bento-info">
          <div class="bento-info-section">
            <p class="bento-label">The Problem</p>
            <p class="bento-text">${d.problem}</p>
          </div>
          <div class="bento-info-section">
            <p class="bento-label">My Solution</p>
            <p class="bento-text">${d.solution}</p>
          </div>
        </div>

        <div class="bento-cell bento-stack">
          <p class="bento-label">Tech Stack</p>
          <div class="stack-grid">
            ${stackHTML}
          </div>
        </div>
      </div>
    `;

    // Photo album click-to-front
    initAlbum();
    initSheetDrag();

    // Lock body scroll
    document.body.style.overflow = "hidden";
    modalOverlay.classList.add("open");
    modalOverlay.setAttribute("aria-hidden", "false");

    // Focus close button
    const closeBtn = $("#modalClose");
    if (closeBtn) closeBtn.focus();
  }

  /* The shuffled card-stack reads well with a cursor but is undiscoverable
     on a phone, where it shrinks to a ~240px box with no swipe. Below the
     mobile breakpoint the same markup becomes a snap-scrolling carousel. */
  const MOBILE_QUERY = "(max-width: 640px)";

  function isMobileLayout() {
    return window.matchMedia(MOBILE_QUERY).matches;
  }

  function initAlbum() {
    const stack = $("#albumStack");
    if (!stack) return;

    const photos = Array.from(stack.querySelectorAll(".album-photo"));

    // Both behaviours are wired up, and each click decides which applies from
    // the *current* layout — otherwise rotating the phone while the modal is
    // open would leave the handlers in the wrong mode.
    stack.addEventListener("click", (e) => {
      const clicked = e.target.closest(".album-photo");
      if (!clicked) return;

      if (isMobileLayout() || clicked.dataset.pos === "0") {
        openLightbox(clicked.src, clicked.alt);
        return;
      }

      const total = photos.length;
      // Bring clicked photo to front: rotate positions
      const clickedPos = parseInt(clicked.dataset.pos, 10);

      photos.forEach((photo) => {
        const current = parseInt(photo.dataset.pos, 10);
        // Shift everyone: the clicked one goes to 0, others shift up
        const newPos = (current - clickedPos + total) % total;
        photo.dataset.pos = newPos;
      });
    });

    initAlbumCarousel(stack, photos);
    updateAlbumHint();
  }

  // Registered once — the modal rebuilds its markup on every open, so a
  // per-open listener would accumulate.
  window.addEventListener("resize", updateAlbumHint);

  function updateAlbumHint() {
    const hint = $("#albumHint");
    if (!hint) return;

    const count = document.querySelectorAll("#albumStack .album-photo").length;

    if (isMobileLayout()) {
      hint.textContent = count > 1 ? "Swipe to browse · tap to enlarge" : "Tap to enlarge";
    } else {
      hint.textContent = count > 1 ? "Click to shuffle · click front to enlarge" : "Click to enlarge";
    }
  }

  /* Dots are built regardless of layout — CSS hides them above the mobile
     breakpoint, so a rotation needs no rebuild. */
  function initAlbumCarousel(stack, photos) {
    const dotsEl = $("#albumDots");

    if (dotsEl && photos.length > 1) {
      dotsEl.innerHTML = photos
        .map((_, i) =>
          `<button class="album-dot${i === 0 ? " active" : ""}" type="button" role="tab" aria-label="Screenshot ${i + 1}"${i === 0 ? ' aria-selected="true"' : ''}></button>`
        )
        .join("");

      dotsEl.addEventListener("click", (e) => {
        const dot = e.target.closest(".album-dot");
        if (!dot) return;
        const i = Array.from(dotsEl.children).indexOf(dot);
        // Scroll the strip itself rather than scrollIntoView, which would
        // also drag the surrounding sheet.
        stack.scrollTo({ left: i * stack.clientWidth, behavior: "smooth" });
      });
    }

    let ticking = false;
    stack.addEventListener("scroll", () => {
      if (ticking || !dotsEl) return;
      ticking = true;
      requestAnimationFrame(() => {
        const width = stack.clientWidth || 1;
        const active = Math.round(stack.scrollLeft / width);
        Array.from(dotsEl.children).forEach((dot, i) => {
          const on = i === active;
          dot.classList.toggle("active", on);
          if (on) {
            dot.setAttribute("aria-selected", "true");
          } else {
            dot.removeAttribute("aria-selected");
          }
        });
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- bottom-sheet drag-to-dismiss ---------- */

  function initSheetDrag() {
    if (!isMobileLayout()) return;

    const head = modalContent.querySelector(".modal-sticky-head");
    if (!head) return;

    let startY = 0;
    let delta = 0;
    let dragging = false;

    // Only the header drags. Dragging from the body would fight the sheet's
    // own vertical scrolling.
    head.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      dragging = true;
      startY = e.touches[0].clientY;
      delta = 0;
      modalContent.style.transition = "none";
    }, { passive: true });

    head.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      delta = Math.max(0, e.touches[0].clientY - startY);
      modalContent.style.transform = `translateY(${delta}px)`;
    }, { passive: true });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      modalContent.style.transition = "";
      modalContent.style.transform = "";
      if (delta > 110) closeModal();
    }

    head.addEventListener("touchend", endDrag);
    head.addEventListener("touchcancel", endDrag);
  }

  /* ---------- lightbox ---------- */

  let lightboxOverlay = null;

  function openLightbox(src, alt) {
    if (!lightboxOverlay) {
      lightboxOverlay = document.createElement("div");
      lightboxOverlay.className = "lightbox";
      lightboxOverlay.setAttribute("aria-hidden", "true");
      // A visible close button — tap-anywhere works but is invisible, and
      // there is no ESC key on a phone.
      lightboxOverlay.innerHTML =
        `<button class="lightbox-close" type="button" aria-label="Close image">×</button><img src="" alt="" />`;
      document.body.appendChild(lightboxOverlay);

      lightboxOverlay.addEventListener("click", () => {
        lightboxOverlay.classList.remove("open");
        lightboxOverlay.setAttribute("aria-hidden", "true");
      });
    }

    const img = lightboxOverlay.querySelector("img");
    img.src = src;
    img.alt = alt;
    lightboxOverlay.setAttribute("aria-hidden", "false");
    
    // trigger reflow
    void lightboxOverlay.offsetWidth;
    lightboxOverlay.classList.add("open");
  }

  function closeModal() {
    modalOverlay.classList.remove("open");
    modalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // Close on overlay click (not content click)
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (lightboxOverlay && lightboxOverlay.classList.contains("open")) {
        lightboxOverlay.classList.remove("open");
        lightboxOverlay.setAttribute("aria-hidden", "true");
        return;
      }
      if (modalOverlay.classList.contains("open")) {
        closeModal();
      }
    }
  });

  // Close button (delegated since it's dynamically inserted)
  modalOverlay.addEventListener("click", (e) => {
    if (e.target.closest("#modalClose")) closeModal();
  });

  /* ---------- IntersectionObserver for card entrance ---------- */

  function observeCards() {
    const cards = document.querySelectorAll(".project-card");
    if (!cards.length) return;

    // If reduced motion, show immediately
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cards.forEach((c) => c.classList.add("in-view"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    cards.forEach((card) => observer.observe(card));
  }

  /* ---------- intro image: random per page load ---------- */

  function setIntroImage() {
    const images = [
      "assets/images/2RiU1RUjyh4C4.webp",
      "assets/images/3oKIPnAiaMCws8nOsE.webp",
      "assets/images/giphy.webp"
    ];
    const img = document.querySelector(".intro-image");
    if (!img) return;

    const chosen = images[Math.floor(Math.random() * images.length)];
    img.src = chosen;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setIntroImage);
  } else {
    setIntroImage();
  }

  const imageWrapper = $("#introImageWrapper");

  /* ---------- cat image click counter ---------- */

  if (imageWrapper) {
    let clicks = 0;
    const counter = $("#clickCounter");

    const milestones = {
      1: "1",
      3: "×3",
      5: "okay that's enough",
      8: "persistent",
      10: "seriously?",
      15: "i admire the dedication",
      20: "you win"
    };

    imageWrapper.addEventListener("click", (e) => {
      e.preventDefault();
      clicks++;

      if (counter) {
        const msg = milestones[clicks] || `×${clicks}`;
        counter.textContent = msg;
        counter.classList.add("visible");
      }
    });
  }

  /* ---------- top page-scroll progress line ---------- */

  const progressFill = $("#progressFill");
  let pageTicking = false;

  function updatePageProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    progressFill.style.width = pct + "%";
    pageTicking = false;
  }

  window.addEventListener("scroll", () => {
    if (!pageTicking) {
      requestAnimationFrame(updatePageProgress);
      pageTicking = true;
    }
  });

  updatePageProgress();

  // Kicked off on its own rather than chained to the projects fetch, so neither
  // section can take the other down.
  initContributions();

  /* ---------- footer live clock (PKT) ---------- */

  const clockEl = $("#footerClock");

  function updateClock() {
    if (!clockEl) return;

    const now = new Date();
    const opts = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Karachi"
    };
    const time = now.toLocaleTimeString("en-US", opts);
    clockEl.textContent = `${time} PKT`;
  }

  if (clockEl) {
    updateClock();
    setInterval(updateClock, 30000); // update every 30s, not every second — performance
  }

  /* ---------- konami easter egg ---------- */

  const konamiCode = [
    "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
    "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight"
  ];
  let konamiIndex = 0;

  document.addEventListener("keydown", (e) => {
    if (e.key === konamiCode[konamiIndex]) {
      konamiIndex++;

      if (konamiIndex === konamiCode.length) {
        konamiIndex = 0;
        triggerEasterEgg();
      }
    } else {
      konamiIndex = 0;
    }
  });

  function triggerEasterEgg() {
    const cards = document.querySelectorAll(".project-card");
    const name = $(".intro-name");
    const els = [name, ...cards].filter(Boolean);

    els.forEach((el) => {
      el.classList.add("konami-wobble");
      el.addEventListener("animationend", () => {
        el.classList.remove("konami-wobble");
      }, { once: true });
    });
  }

})();
