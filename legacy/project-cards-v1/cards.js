/* ============================================================
   ARCHIVED — project cards, version 1 ("folder tab" cards)
   renderProjects() lifted verbatim out of js/main.js when the
   v2 cards (export/ProjectCard.jsx) replaced them. Kept for
   reference / rollback only; this file is NOT loaded by the site.

   It closes over `allProjects` and calls kindOf() and openModal(),
   all of which still live in js/main.js.
   ============================================================ */

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
