// Portfolio project card — variant 1C
// Next.js / React + Tailwind. Hover effect is pure CSS (group-hover), no JS state.
//
// Usage:
//   import ProjectCard from "@/components/ProjectCard";
//   <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
//     {projects.map((p) => <ProjectCard key={p.title} {...p} />)}
//   </div>

import Image from "next/image";

export default function ProjectCard({
  title,
  tagline,
  taglineColor = "#a49a92", // e.g. "#4fa596" teal, "#e2673f" orange
  description,
  image, // { src, alt } — the product screenshot
  glow = "rgba(226,103,63,.35)", // ambient hover glow behind the screenshot
  status, // "live" | "discontinued" | undefined
  liveUrl,
  githubUrl,
  tags = [],
}) {
  const actions = [liveUrl, githubUrl].filter(Boolean).length;

  return (
    <div className="group flex min-h-[520px] flex-col overflow-hidden rounded-[14px] border border-[#2b2521] bg-[#1c1815] transition-colors duration-400 hover:border-[#453b35]">
      {/* preview */}
      <div className="relative h-[200px] overflow-hidden border-b border-[#2b2521] bg-[#191512]">
        <div
          className="pointer-events-none absolute -inset-[30%] opacity-0 blur-[34px] transition-opacity duration-[620ms] group-hover:opacity-100"
          style={{
            background: `radial-gradient(60% 60% at 50% 40%, ${glow}, transparent 70%)`,
          }}
        />
        <div className="absolute inset-x-[22px] -bottom-[18px] top-6 overflow-hidden rounded-t-lg border border-b-0 border-[#352e28] shadow-[0_10px_24px_-18px_rgba(0,0,0,.6)] transition-[transform,box-shadow] duration-[620ms] ease-[cubic-bezier(.16,.84,.28,1)] will-change-transform group-hover:-translate-y-[9px] group-hover:scale-[1.04] group-hover:shadow-[0_24px_48px_-18px_rgba(0,0,0,.85)]">
          {image ? (
            <Image
              src={image.src}
              alt={image.alt ?? title}
              width={750}
              height={450}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center font-mono text-[11px] tracking-[.08em] text-[#6b625b]"
              style={{
                background:
                  "repeating-linear-gradient(135deg,#1d1815 0 8px,#211c18 8px 16px)",
              }}
            >
              product shot
            </div>
          )}
        </div>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3.5 px-[22px] pb-[22px] pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[22px] font-semibold tracking-[-.015em] text-[#f0ebe4]">
            {title}
          </h3>
          {status === "live" && (
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-[#5fbf8a]" />
              <span className="font-mono text-[11px] text-[#9c928a]">live</span>
            </span>
          )}
          {status && status !== "live" && (
            <span className="font-mono text-[11px] text-[#e2673f]">◆</span>
          )}
        </div>

        {tagline && (
          <p
            className="text-sm font-medium"
            style={{ color: taglineColor }}
          >
            {tagline}
          </p>
        )}

        <p className="text-pretty text-sm leading-relaxed text-[#a49a92]">
          {description}
        </p>

        <div className="mt-auto flex flex-col gap-4">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-3.5 font-mono text-[11px] text-[#7d736b]">
              {tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          )}

          {actions > 0 && (
            <div
              className={`grid gap-2.5 ${actions === 2 ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {liveUrl && (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[7px] bg-[#e2673f] p-2.5 text-center text-[13px] font-semibold text-[#17130f] transition-colors hover:bg-[#f0784f]"
                >
                  View Live
                </a>
              )}
              {githubUrl && (
                <a
                  href={githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-[7px] border border-[#38312b] p-2.5 text-center text-[13px] font-medium text-[#c8beb6] transition-colors hover:border-[#544a43] hover:text-[#efe9e2]"
                >
                  GitHub
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
