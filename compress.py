#!/usr/bin/env python3
"""
Drop images/GIFs/clips into ./input, run this, answer two questions per file.

  * Project screenshot -> framed into the generic.png macbook window,
                          saved as assets/projects/<project-id>/NN.webp,
                          and registered in data/projects.json.
  * Standalone image   -> just compressed into assets/images/.

Everything comes out as WebP (animated WebP for GIFs/clips). The only
dependency is ffmpeg/ffprobe.

    python3 compress.py [--input DIR] [--quality N] [--anim-quality N]
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT_DIR = ROOT / "input"
IMAGES_DIR = ROOT / "assets" / "images"
PROJECTS_DIR = ROOT / "assets" / "projects"
PROJECTS_JSON = ROOT / "data" / "projects.json"

TEMPLATE = PROJECTS_DIR / "generic.png"          # window frame + shadow
TOPBAR = IMAGES_DIR / "generic-topbar.png"       # macbook title bar
PLACEHOLDER = "assets/projects/generic.png"      # dropped once real shots exist

# Window geometry, measured from generic.png. The content area is inset by
# TOPBAR's height at the top and MARGIN on the other three sides, so the
# composite always ends up exactly the same size as generic.png.
MARGIN = 51

# Encoder settings; quality is the usual 0-100 lossy scale. compression_level
# is where the effort/size trade-off lives: on a still it is free, but on a
# 15-frame animation level 6 measured 70s vs 10s at level 4 for 0.6% less
# weight -- not worth it.
STILL_QUALITY = 88
ANIM_QUALITY = 78
STILL_EFFORT = 6
ANIM_EFFORT = 4
MAX_FPS = 25              # animations above this get resampled down
MAX_EDGE = 2400           # standalone images are capped to this long edge

SOURCE_EXTS = {
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff",
    ".avif", ".apng", ".mp4", ".mov", ".webm", ".mkv", ".m4v",
}


# --------------------------------------------------------------------------
# shell helpers
# --------------------------------------------------------------------------

@contextmanager
def cleanup_on_failure(dst):
    """Never leave a half-written file behind — it would poison the index."""
    try:
        yield
    except BaseException:
        dst.unlink(missing_ok=True)
        raise


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed:\n{result.stderr.strip()}")
    return result.stdout


def probe(path):
    """Return (width, height, frame_count, fps) for any image or video."""
    out = run([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets",
        "-show_entries", "stream=width,height,nb_read_packets,avg_frame_rate",
        "-of", "json", str(path),
    ])
    streams = json.loads(out).get("streams") or []
    if not streams:
        raise RuntimeError(f"no video stream in {path.name}")
    s = streams[0]
    num, _, den = (s.get("avg_frame_rate") or "0/1").partition("/")
    fps = float(num) / float(den) if float(den or 0) else 0.0
    return int(s["width"]), int(s["height"]), int(s.get("nb_read_packets") or 1), fps


def encode(inputs, filtergraph, dst, animated):
    """inputs: list of ffmpeg input argument lists, e.g. [["-i", "a.png"], ...]"""
    cmd = ["ffmpeg", "-y", "-v", "error"]
    for input_args in inputs:
        cmd += input_args
    cmd += ["-filter_complex", filtergraph, "-map", "[out]", "-an"]
    if animated:
        cmd += [
            "-c:v", "libwebp_anim", "-pix_fmt", "yuva420p", "-loop", "0",
            "-quality", str(ANIM_QUALITY), "-compression_level", str(ANIM_EFFORT),
        ]
    else:
        cmd += [
            "-c:v", "libwebp", "-frames:v", "1", "-preset", "picture",
            "-quality", str(STILL_QUALITY), "-compression_level", str(STILL_EFFORT),
        ]
    cmd += [str(dst)]
    run(cmd)


# --------------------------------------------------------------------------
# reading the source
# --------------------------------------------------------------------------

def is_animated_webp(path):
    """ffmpeg's webp decoder skips ANIM/ANMF chunks, so spot these ourselves."""
    if path.suffix.lower() != ".webp":
        return False
    with path.open("rb") as fh:
        return b"ANIM" in fh.read(4096)


def expand_animated_webp(src, workdir):
    """Explode an animated WebP into a PNG sequence ffmpeg can read."""
    if not shutil.which("magick"):
        raise RuntimeError(
            "animated WebP needs ImageMagick to decode — `sudo pacman -S imagemagick`"
        )
    run(["magick", str(src), "-coalesce", str(workdir / "%04d.png")])
    frames = sorted(workdir.glob("*.png"))
    if not frames:
        raise RuntimeError("ImageMagick produced no frames")

    # %T is the per-frame delay in centiseconds; average it into a frame rate.
    delays = [int(d) for d in run(["magick", "identify", "-format", "%T ", str(src)]).split()]
    delays = [d for d in delays if d > 0]
    fps = 100 / (sum(delays) / len(delays)) if delays else 10.0

    width, height, _, _ = probe(frames[0])
    args = ["-framerate", f"{fps:.4f}", "-i", str(workdir / "%04d.png")]
    return args, width, height, len(frames), fps


def image_size(path):
    """Width/height of an output, or None if nothing here can read it back."""
    if is_animated_webp(path):
        if not shutil.which("magick"):
            return None          # unverifiable, but not a reason to bin the file
        w, h = run(["magick", "identify", "-format", "%w %h", f"{path}[0]"]).split()
        return int(w), int(h)
    width, height, _, _ = probe(path)
    return width, height


def read_source(src, workdir):
    """Returns (ffmpeg input args, width, height, frame count, fps)."""
    if is_animated_webp(src):
        return expand_animated_webp(src, workdir)
    width, height, frames, fps = probe(src)
    return ["-i", str(src)], width, height, frames, fps


# --------------------------------------------------------------------------
# filtergraphs
# --------------------------------------------------------------------------

def frame_geometry():
    canvas_w, canvas_h, _, _ = probe(TEMPLATE)
    bar_w, bar_src_h, _, _ = probe(TOPBAR)
    bar_h = round(canvas_w * bar_src_h / bar_w)   # title bar is fitted to the canvas
    body_w = canvas_w - 2 * MARGIN
    body_h = canvas_h - bar_h - MARGIN
    if body_w <= 0 or body_h <= 0:
        raise RuntimeError("generic.png is smaller than its own window frame")
    return canvas_w, canvas_h, bar_h, body_w, body_h


def project_filter(geometry, fps_cap):
    """
    Inputs: 0 = source, 1 = generic.png, 2 = generic-topbar.png

    The source is cover-fitted to the window's content area and laid into the
    canvas at (MARGIN, bar_h) -- it is never painted over. The frame's own
    alpha supplies the rounded bottom corners, and generic.png with the body
    knocked out supplies the drop shadow around the edges.
    """
    canvas_w, canvas_h, bar_h, body_w, body_h = geometry
    x0, y0 = MARGIN, bar_h
    x1, y1 = MARGIN + body_w - 1, bar_h + body_h - 1

    rate = f"fps={fps_cap}," if fps_cap else ""
    return (
        # rounded-corner mask, lifted straight out of the template's alpha
        f"[1:v]crop={body_w}:{body_h}:{x0}:{y0},alphaextract[mask];"
        # the frame itself, with the content area punched out to leave the shadow
        f"[1:v]format=rgba,geq="
        f"r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)':"
        f"a='if(between(X\\,{x0}\\,{x1})*between(Y\\,{y0}\\,{y1})\\,0\\,alpha(X\\,Y))'[ring];"
        # source -> exact content size, rounded, dropped onto a transparent canvas
        f"[0:v]{rate}scale={body_w}:{body_h}:force_original_aspect_ratio=increase:flags=lanczos,"
        f"crop={body_w}:{body_h},format=rgba[shot];"
        f"[shot][mask]alphamerge[rounded];"
        f"[rounded]pad={canvas_w}:{canvas_h}:{x0}:{y0}:color=#00000000[body];"
        # shadow, then the title bar on top
        f"[2:v]scale={canvas_w}:{bar_h}:flags=lanczos[bar];"
        f"[body][ring]overlay=0:0[framed];"
        f"[framed][bar]overlay=0:0:format=auto[out]"
    )


def image_filter(width, height, fps_cap):
    """Plain compression for assets/images -- only downscale if oversized."""
    steps = []
    if fps_cap:
        steps.append(f"fps={fps_cap}")
    long_edge = max(width, height)
    if long_edge > MAX_EDGE:
        scale = MAX_EDGE / long_edge
        w = max(2, round(width * scale) // 2 * 2)
        h = max(2, round(height * scale) // 2 * 2)
        steps.append(f"scale={w}:{h}:flags=lanczos")
    steps.append("format=rgba")
    return f"[0:v]{','.join(steps)}[out]"


# --------------------------------------------------------------------------
# prompts
# --------------------------------------------------------------------------

def ask(question, options, default=None):
    """options: list of (label, value). Returns the chosen value."""
    print(f"\n  {question}")
    for i, (label, _) in enumerate(options, 1):
        marker = " (enter)" if default is not None and i - 1 == default else ""
        print(f"    {i}) {label}{marker}")
    while True:
        raw = input("  > ").strip()
        if not raw and default is not None:
            return options[default][1]
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1][1]
        print("  pick a number from the list")


def ask_text(question, validate=None):
    while True:
        raw = input(f"  {question} ").strip()
        if not raw:
            continue
        if validate:
            problem = validate(raw)
            if problem:
                print(f"  {problem}")
                continue
        return raw


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# --------------------------------------------------------------------------
# projects.json
# --------------------------------------------------------------------------

def load_projects():
    if not PROJECTS_JSON.exists():
        return []
    return json.loads(PROJECTS_JSON.read_text(encoding="utf-8"))


# Leaf objects such as { "name": "Python", "icon": "python" } are written on one
# line in projects.json; re-collapsing them keeps the diff down to what changed.
LEAF_OBJECT = re.compile(r"\{\s*\n\s*([^{}\[\]]*?)\n\s*\}", re.S)


def save_projects(projects):
    def collapse(match):
        body = " ".join(line.strip() for line in match.group(1).splitlines())
        inline = "{ " + body + " }"
        return inline if len(inline) <= 80 else match.group(0)

    text = json.dumps(projects, indent=2, ensure_ascii=False)
    PROJECTS_JSON.write_text(LEAF_OBJECT.sub(collapse, text) + "\n", encoding="utf-8")


def stub_project(project_id, title):
    return {
        "id": project_id,
        "index": "🗂️",
        "title": title,
        "tagline": "",
        "description": "",
        "url": "",
        "year": "",
        "accent": "#5E6AD2",
        "mark": title[:1].upper(),
        "featured": False,
        # Matches the site's default for a missing kind; flip to "client" by hand.
        "kind": "personal",
        "tags": [],
        "detail": {"problem": "", "solution": "", "stack": [], "screenshots": []},
    }


def register_screenshot(projects, project_id, rel_path):
    """Append a screenshot, dropping the generic.png placeholders on the way."""
    project = next((p for p in projects if p.get("id") == project_id), None)
    if project is None:
        return False
    detail = project.setdefault("detail", {})
    shots = [s for s in detail.get("screenshots", []) if s != PLACEHOLDER]
    if rel_path not in shots:
        shots.append(rel_path)
    detail["screenshots"] = shots
    return True


def next_index(directory):
    used = {
        int(p.stem) for p in directory.glob("*")
        if p.is_file() and p.stem.isdigit()
    }
    return max(used, default=0) + 1


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------

def choose_project(projects):
    """Returns a project id, creating a stub entry if the user wants one."""
    options = [(f"{p['id']}  —  {p.get('title', '')}", p["id"]) for p in projects]
    options.append(("+ new project", None))
    chosen = ask("Which project?", options, default=0 if options[:-1] else None)
    if chosen is not None:
        return chosen

    title = ask_text("Project name:")
    project_id = slugify(title)
    if any(p.get("id") == project_id for p in projects):
        return project_id
    action = ask(
        f"'{project_id}' is not in projects.json yet.",
        [("Add a stub entry I'll fill in later", "stub"),
         ("Just save the files, leave the JSON alone", "skip")],
        default=0,
    )
    if action == "stub":
        projects.append(stub_project(project_id, title))
    return project_id


def process(src, geometry, projects, last_choice, workdir):
    source, width, height, frames, fps = read_source(src, workdir)
    animated = frames > 1
    kind = f"{width}x{height}, {'animated, ' + str(frames) + ' frames' if animated else 'still'}"
    print(f"\n{'─' * 60}\n{src.name}  ({kind})")

    destination = ask(
        "Where does this go?",
        [("Project screenshot  →  assets/projects/<project>/", "project"),
         ("Standalone image    →  assets/images/", "image")],
        default={"project": 0, "image": 1}.get(last_choice, 0),
    )

    fps_cap = MAX_FPS if animated and fps > MAX_FPS else None

    if destination == "project":
        project_id = choose_project(projects)
        out_dir = PROJECTS_DIR / project_id
        out_dir.mkdir(parents=True, exist_ok=True)
        dst = out_dir / f"{next_index(out_dir):02d}.webp"
        inputs = [source, ["-i", str(TEMPLATE)], ["-i", str(TOPBAR)]]
        with cleanup_on_failure(dst):
            encode(inputs, project_filter(geometry, fps_cap), dst, animated)
            size = image_size(dst)
            if size is not None and size != geometry[:2]:
                raise RuntimeError(
                    f"{dst.name} came out {size[0]}x{size[1]}, "
                    f"expected {geometry[0]}x{geometry[1]}"
                )

        rel = f"assets/projects/{project_id}/{dst.name}"
        if register_screenshot(projects, project_id, rel):
            print(f"  + projects.json → {project_id}.detail.screenshots")
    else:
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        dst = IMAGES_DIR / f"{slugify(src.stem)}.webp"
        n = 2
        while dst.exists():
            dst = IMAGES_DIR / f"{slugify(src.stem)}-{n}.webp"
            n += 1
        with cleanup_on_failure(dst):
            encode([source], image_filter(width, height, fps_cap), dst, animated)

    before, after = src.stat().st_size, dst.stat().st_size
    delta = (after - before) / before * 100 if before else 0
    print(f"  ✓ {dst.relative_to(ROOT)}  "
          f"({before / 1024:.0f} KB → {after / 1024:.0f} KB, {delta:+.0f}%)")
    return destination


def main():
    global STILL_QUALITY, ANIM_QUALITY

    parser = argparse.ArgumentParser(description="Compress and file site assets.")
    parser.add_argument("--input", type=Path, default=INPUT_DIR, help="source directory")
    parser.add_argument("--quality", type=int, help=f"still WebP quality (default {STILL_QUALITY})")
    parser.add_argument("--anim-quality", type=int, help=f"animated WebP quality (default {ANIM_QUALITY})")
    args = parser.parse_args()

    if args.quality:
        STILL_QUALITY = args.quality
    if args.anim_quality:
        ANIM_QUALITY = args.anim_quality

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            sys.exit(f"{tool} is not installed — `sudo pacman -S ffmpeg`")
    for asset in (TEMPLATE, TOPBAR):
        if not asset.exists():
            sys.exit(f"missing template: {asset.relative_to(ROOT)}")

    source_dir = args.input
    if not source_dir.exists():
        source_dir.mkdir(parents=True)
        gitignore = source_dir / ".gitignore"
        gitignore.write_text("*\n!.gitignore\n", encoding="utf-8")
        sys.exit(f"created {source_dir.relative_to(ROOT)}/ — drop your files in there and re-run")

    files = sorted(
        p for p in source_dir.rglob("*")
        if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in SOURCE_EXTS
    )
    if not files:
        sys.exit(f"nothing to do — {source_dir.relative_to(ROOT)}/ has no images")

    geometry = frame_geometry()
    projects = load_projects()
    original = json.dumps(projects, sort_keys=True)

    print(f"{len(files)} file(s) · window frame {geometry[0]}x{geometry[1]} "
          f"(content {geometry[3]}x{geometry[4]} under a {geometry[2]}px bar)")

    last_choice, done, failed = None, 0, []
    try:
        for src in files:
            with tempfile.TemporaryDirectory(prefix="compress-") as tmp:
                try:
                    last_choice = process(src, geometry, projects, last_choice, Path(tmp))
                    done += 1
                except (RuntimeError, OSError) as err:
                    failed.append(src.name)
                    print(f"  ✗ {src.name}: {err}")
    finally:
        # Runs even on Ctrl-C, so finished files never fall out of the JSON.
        if json.dumps(projects, sort_keys=True) != original:
            save_projects(projects)
            print(f"\nupdated {PROJECTS_JSON.relative_to(ROOT)}")

    print(f"\n{done}/{len(files)} processed" + (f", failed: {', '.join(failed)}" if failed else ""))
    print(f"originals left untouched in {source_dir.relative_to(ROOT)}/")


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        sys.exit("\naborted")
