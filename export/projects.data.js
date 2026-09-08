// Example data shape for ProjectCard (variant 1C)
export const projects = [
  {
    title: "True Momentum",
    tagline: "Turning an AI pipeline into a real product",
    taglineColor: "#4fa596",
    description:
      "I built the full-stack web application around an existing AI revenue-diagnostic pipeline — user-facing experience, diagnostic flow, backend, payments, and product infrastructure.",
    image: { src: "/projects/true-momentum.png", alt: "True Momentum" },
    glow: "rgba(79,165,150,.42)",
    status: "live",
    liveUrl: "https://example.com",
    githubUrl: "https://github.com/you/true-momentum",
    tags: ["Full Stack", "React", "Node.js", "AI"],
  },
  {
    title: "Auspec Pharma",
    tagline: "A complete digital platform for a pharmaceutical company",
    taglineColor: "#9c928a",
    description:
      "A public product and company portfolio, a working contact system, and an internal admin portal where the team manages products, vacancies, and QR-linked digital leaflets.",
    image: { src: "/projects/auspec.png", alt: "Auspec Pharma" },
    glow: "rgba(226,103,63,.30)",
    status: "live",
    liveUrl: "https://example.com",
    tags: ["Node.js", "React", "Full Stack", "Cloudflare"],
  },
  {
    title: "FlexPlus",
    tagline: "A better university portal",
    taglineColor: "#e2673f",
    description:
      "A browser extension that overhauls the FAST student portal with no changes to the university's system: prerequisite checker, SGPA/CGPA simulator, and total-fee calculator.",
    image: { src: "/projects/flexplus.png", alt: "FlexPlus" },
    glow: "rgba(226,103,63,.42)",
    status: "extension",
    githubUrl: "https://github.com/you/flexplus",
    tags: ["JavaScript", "HTML", "CSS", "Browser APIs"],
  },
];
