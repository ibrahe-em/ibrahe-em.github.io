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
        <li class="project-card${featuredClass}${ongoingClass}" style="--project-accent:${p.accent}; --card-i:${i};" data-project-id="${p.id}">
          <div class="project-link" role="button" tabindex="0" aria-label="View ${p.title} details">
            <h3 class="project-title">${p.title}</h3>
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

      function openCard(e) {
        // Don't open modal for ongoing projects
        if (card.classList.contains("ongoing")) return;
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
      <div class="modal-header">
        <div class="modal-header-left">
          <h2 class="modal-title">${project.title}</h2>
          <p class="modal-tagline">${project.tagline}</p>
        </div>
        <div class="modal-header-actions">
          <a class="modal-link" href="${project.url}" target="_blank" rel="noopener noreferrer" aria-label="View on GitHub">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.81.5 12.38c0 5.26 3.39 9.72 8.09 11.29.59.11.81-.26.81-.58v-2.02c-3.29.74-3.98-1.39-3.98-1.39-.54-1.42-1.32-1.8-1.32-1.8-1.08-.76.08-.75.08-.75 1.2.09 1.83 1.28 1.83 1.28 1.06 1.88 2.77 1.34 3.45 1.03.11-.79.42-1.34.76-1.65-2.63-.31-5.39-1.36-5.39-6.06 0-1.34.46-2.44 1.22-3.3-.12-.31-.53-1.56.12-3.24 0 0 .99-.33 3.24 1.26a11.02 11.02 0 0 1 5.9 0c2.24-1.59 3.23-1.26 3.23-1.26.65 1.68.24 2.93.12 3.24.76.86 1.22 1.96 1.22 3.3 0 4.71-2.77 5.74-5.41 6.05.43.39.81 1.16.81 2.34v3.47c0 .32.22.7.82.58 4.7-1.57 8.08-6.03 8.08-11.29C23.5 5.81 18.35.5 12 .5Z"/></svg>
            <span>GitHub</span>
          </a>
          <button class="modal-close" id="modalClose" aria-label="Close modal">×</button>
        </div>
      </div>

      <div class="bento-grid">
        <div class="bento-cell bento-album">
          <p class="bento-label">Screenshots</p>
          <div class="album-stack" id="albumStack">
            ${albumHTML}
          </div>
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

    // Lock body scroll
    document.body.style.overflow = "hidden";
    modalOverlay.classList.add("open");
    modalOverlay.setAttribute("aria-hidden", "false");

    // Focus close button
    const closeBtn = $("#modalClose");
    if (closeBtn) closeBtn.focus();
  }

  function initAlbum() {
    const stack = $("#albumStack");
    if (!stack) return;

    stack.addEventListener("click", (e) => {
      const clicked = e.target.closest(".album-photo");
      if (!clicked) return;

      if (clicked.dataset.pos === "0") {
        openLightbox(clicked.src, clicked.alt);
        return;
      }

      const photos = Array.from(stack.querySelectorAll(".album-photo"));
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
  }

  /* ---------- lightbox ---------- */

  let lightboxOverlay = null;

  function openLightbox(src, alt) {
    if (!lightboxOverlay) {
      lightboxOverlay = document.createElement("div");
      lightboxOverlay.className = "lightbox";
      lightboxOverlay.setAttribute("aria-hidden", "true");
      lightboxOverlay.innerHTML = `<img src="" alt="" />`;
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
