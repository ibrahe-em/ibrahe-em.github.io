#!/usr/bin/env python3
"""
compress_images.py - batch-optimize images for the web.

Non-destructive by default: reads from SOURCE, writes to an output directory,
mirroring the folder structure. Emits an optimized file in the original format
plus modern formats (WebP / AVIF) so you can serve them from <picture>.

    python compress_images.py ./images/projects
    python compress_images.py ./images/projects -o ./dist/images --max-dim 2000
    python compress_images.py ./images/projects --avif --quality 80
    python compress_images.py ./images/projects --in-place --no-webp   # careful

Requires Pillow. AVIF needs Pillow >= 11.3 or `pip install pillow-avif-plugin`.
"""

from __future__ import annotations

import argparse
import io
import os
import shutil
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageOps

try:  # optional AVIF plugin for older Pillow
    import pillow_avif  # noqa: F401
except ImportError:
    pass

Image.init()
AVIF_AVAILABLE = "AVIF" in Image.SAVE
LANCZOS = getattr(Image, "Resampling", Image).LANCZOS

SOURCE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"}
EXT_FOR_FORMAT = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "AVIF": ".avif"}

# Don't let a decompression-bomb image take the process down.
Image.MAX_IMAGE_PIXELS = 256_000_000


# --------------------------------------------------------------------------- #
# results
# --------------------------------------------------------------------------- #

@dataclass
class Result:
    src: Path
    before: int = 0
    after: int = 0       # bytes a browser actually downloads (smallest output)
    written: int = 0     # bytes added to the build output
    outputs: list[str] = field(default_factory=list)
    note: str = ""
    error: str = ""


def human(n: float) -> str:
    sign = "-" if n < 0 else ""
    n = abs(n)
    for unit in ("B", "KB", "MB", "GB"):
        if abs(n) < 1024 or unit == "GB":
            return f"{sign}{n:.0f} {unit}" if unit == "B" else f"{sign}{n:.1f} {unit}"
        n /= 1024
    return f"{sign}{n:.1f} GB"


# --------------------------------------------------------------------------- #
# progress
# --------------------------------------------------------------------------- #

class Progress:
    """Single-line live progress bar; falls back to plain lines when piped."""

    def __init__(self, total: int, stream=sys.stderr):
        self.total = total
        self.done = 0
        self.saved = 0
        self.stream = stream
        self.tty = stream.isatty()
        self.start = time.monotonic()
        self.lock = threading.Lock()
        self._width = 0

    def update(self, res: Result) -> None:
        with self.lock:
            self.done += 1
            self.saved += res.before - res.after
            if self.tty:
                self._draw(res)
            else:
                pct = self.done / self.total * 100
                label = res.error or res.note or human(res.after - res.before)
                print(f"[{self.done}/{self.total}] {pct:5.1f}%  {res.src}  {label}",
                      file=self.stream, flush=True)

    def _draw(self, res: Result) -> None:
        frac = self.done / self.total
        cols = shutil.get_terminal_size((100, 20)).columns
        bar_len = 24
        filled = int(bar_len * frac)
        bar = "█" * filled + "░" * (bar_len - filled)

        elapsed = time.monotonic() - self.start
        eta = elapsed / frac - elapsed if frac else 0
        head = (f"\r[{bar}] {self.done}/{self.total} {frac*100:5.1f}%  "
                f"saved {human(self.saved)}  eta {int(eta)//60:02d}:{int(eta)%60:02d}  ")

        name = res.src.name
        room = max(0, cols - len(head) - 1)
        if len(name) > room:
            name = name[: max(0, room - 1)] + "…"
        line = head + name

        pad = " " * max(0, self._width - len(line))
        self._width = len(line)
        self.stream.write(line + pad)
        self.stream.flush()

    def close(self) -> None:
        if self.tty:
            self.stream.write("\r" + " " * self._width + "\r")
            self.stream.flush()


# --------------------------------------------------------------------------- #
# encoding
# --------------------------------------------------------------------------- #

def has_alpha(img: Image.Image) -> bool:
    return img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info


def flatten(img: Image.Image, background: str) -> Image.Image:
    """Composite transparency onto a solid colour (JPEG has no alpha channel)."""
    if not has_alpha(img):
        return img.convert("RGB")
    img = img.convert("RGBA")
    canvas = Image.new("RGB", img.size, background)
    canvas.paste(img, mask=img.getchannel("A"))
    return canvas


def palettize(img: Image.Image) -> Image.Image:
    """Losslessly shrink PNGs that use 256 colours or fewer (icons, logos, UI)."""
    if img.mode in ("RGB", "RGBA") and img.getcolors(256) is not None:
        # FASTOCTREE is the only method that handles an alpha channel.
        method = (Image.Quantize.FASTOCTREE if has_alpha(img)
                  else Image.Quantize.MEDIANCUT)
        return img.quantize(colors=256, method=method)
    return img


def encode(img: Image.Image, fmt: str, args, icc: bytes | None) -> bytes:
    buf = io.BytesIO()
    opts: dict = {}
    if icc and not args.strip_icc:
        opts["icc_profile"] = icc

    if fmt == "JPEG":
        img = flatten(img, args.background)
        opts.update(quality=args.quality, optimize=True, progressive=True,
                    subsampling="4:2:0")
    elif fmt == "PNG":
        img = palettize(img)
        opts.update(optimize=True, compress_level=9)
    elif fmt == "WEBP":
        if args.lossless_webp:
            opts.update(lossless=True, quality=100, method=6)
        else:
            opts.update(quality=args.quality, method=6)
    elif fmt == "AVIF":
        opts.update(quality=args.quality, speed=args.avif_speed)

    img.save(buf, fmt, **opts)
    return buf.getvalue()


def targets_for(src_ext: str, args) -> list[str]:
    """Which formats to write for a given source file."""
    base = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP",
            ".gif": "PNG", ".bmp": "PNG", ".tif": "PNG", ".tiff": "PNG"}[src_ext]
    out = [] if args.only_modern and base != "WEBP" else [base]
    if args.webp and base != "WEBP":
        out.append("WEBP")
    if args.avif and AVIF_AVAILABLE:
        out.append("AVIF")
    return out or [base]


# --------------------------------------------------------------------------- #
# per-file work
# --------------------------------------------------------------------------- #

def process(src: Path, root: Path, out_root: Path, args) -> Result:
    res = Result(src=src)
    try:
        res.before = src.stat().st_size
        rel = src.relative_to(root)
        dest_dir = out_root / rel.parent

        with Image.open(src) as opened:
            if getattr(opened, "is_animated", False):
                # Animated GIF/WebP: re-encoding frame-by-frame is a different
                # job (and usually a video conversion). Pass it through.
                res.note = "animated, copied as-is"
                res.after = res.written = res.before
                if not args.dry_run and not args.in_place:
                    dest_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src, dest_dir / src.name)
                return res

            icc = opened.info.get("icc_profile")
            img = ImageOps.exif_transpose(opened)  # honour camera rotation
            original_size = img.size

            if args.max_dim and max(img.size) > args.max_dim:
                img.thumbnail((args.max_dim, args.max_dim), LANCZOS)

            resized = img.size != original_size
            encoded: dict[str, bytes] = {}
            for fmt in targets_for(src.suffix.lower(), args):
                encoded[fmt] = encode(img, fmt, args, icc)
            img.close()

        source_bytes = src.read_bytes()
        source_fmt = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG",
                      ".webp": "WEBP"}.get(src.suffix.lower())

        # Re-encoding an already-optimized file usually makes it bigger and
        # always makes a JPEG worse. Keep the original when we didn't win.
        if (source_fmt in encoded and not resized
                and len(encoded[source_fmt]) >= len(source_bytes)):
            encoded[source_fmt] = source_bytes
            res.note = "original kept (already optimal)"

        # A lossy sibling that's bigger than the fallback is dead weight -
        # noisy PNGs and tiny sprites often land here. Don't ship it.
        if source_fmt in encoded and not args.only_modern:
            fallback = len(encoded[source_fmt])
            for fmt in ("WEBP", "AVIF"):
                if fmt in encoded and fmt != source_fmt and len(encoded[fmt]) >= fallback:
                    del encoded[fmt]

        if resized:
            res.note = f"{original_size[0]}x{original_size[1]} -> {img.size[0]}x{img.size[1]}"

        res.written = sum(len(b) for b in encoded.values())
        res.after = min(len(b) for b in encoded.values())
        res.outputs = [EXT_FOR_FORMAT[f] for f in encoded]

        if not args.dry_run:
            dest_dir.mkdir(parents=True, exist_ok=True)
            for fmt, data in encoded.items():
                dest = dest_dir / (src.stem + EXT_FOR_FORMAT[fmt])
                tmp = dest.with_suffix(dest.suffix + ".tmp")
                tmp.write_bytes(data)
                os.replace(tmp, dest)  # atomic: never leave a half-written asset
    except Exception as exc:  # noqa: BLE001 - one bad file shouldn't kill the run
        res.error = f"{type(exc).__name__}: {exc}"
        res.after = res.written = res.before
    return res


# --------------------------------------------------------------------------- #
# cli
# --------------------------------------------------------------------------- #

def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Optimize images for the web.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("source", nargs="?", default="./assets/projects",
                   help="directory to scan (recursively)")
    p.add_argument("-o", "--out", default=None,
                   help="output directory [default: <source>-optimized]")
    p.add_argument("--in-place", action="store_true",
                   help="overwrite the source directory (destructive)")
    p.add_argument("-q", "--quality", type=int, default=82,
                   help="lossy quality, 0-100")
    p.add_argument("--max-dim", type=int, default=2560,
                   help="cap the longest edge in px (0 disables)")
    p.add_argument("--no-webp", dest="webp", action="store_false",
                   help="don't emit .webp siblings")
    p.add_argument("--avif", action="store_true",
                   help="also emit .avif (smallest, slowest to encode)")
    p.add_argument("--avif-speed", type=int, default=6,
                   help="AVIF encoder speed, 0=slowest/smallest .. 10")
    p.add_argument("--only-modern", action="store_true",
                   help="emit only webp/avif, no original-format fallback")
    p.add_argument("--lossless-webp", action="store_true",
                   help="lossless WebP (for flat graphics and logos)")
    p.add_argument("--background", default="#ffffff",
                   help="colour used to flatten alpha when writing JPEG")
    p.add_argument("--strip-icc", action="store_true",
                   help="drop the colour profile too (saves a few KB)")
    p.add_argument("-j", "--jobs", type=int, default=min(8, (os.cpu_count() or 4)),
                   help="parallel workers")
    p.add_argument("-n", "--dry-run", action="store_true",
                   help="report savings without writing anything")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    root = Path(args.source).resolve()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 2

    out_root = root if args.in_place else Path(
        args.out or f"{root}-optimized").resolve()

    if args.in_place and not args.dry_run:
        print("WARNING: --in-place overwrites your originals. "
              "Make sure they're in version control.", file=sys.stderr)

    files = sorted(
        p for p in root.rglob("*")
        if p.is_file()
        and p.suffix.lower() in SOURCE_EXTS
        and not p.name.startswith(".")
        # never re-read our own output when it lives under the source tree
        and (args.in_place or out_root not in p.parents)
    )
    if not files:
        print(f"No images found under {root}")
        return 0

    if args.avif and not AVIF_AVAILABLE:
        print("note: AVIF unsupported by this Pillow build; skipping .avif "
              "(pip install pillow-avif-plugin)", file=sys.stderr)

    print(f"{len(files)} image(s) in {root}")
    print(f"-> {out_root}{'  (dry run)' if args.dry_run else ''}\n")

    progress = Progress(len(files))
    results: list[Result] = []

    if args.jobs > 1:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=args.jobs) as pool:
            for res in pool.map(lambda f: process(f, root, out_root, args), files):
                results.append(res)
                progress.update(res)
    else:
        for f in files:
            res = process(f, root, out_root, args)
            results.append(res)
            progress.update(res)
    progress.close()

    before = sum(r.before for r in results)
    after = sum(r.after for r in results)
    written = sum(r.written for r in results)
    failed = [r for r in results if r.error]
    pct = (before - after) / before * 100 if before else 0

    for r in sorted(results, key=lambda r: r.before - r.after, reverse=True)[:10]:
        if r.before - r.after > 0:
            print(f"  -{human(r.before - r.after):>9}  "
                  f"{human(r.before):>9} -> {human(r.after):<9}  "
                  f"{r.src.relative_to(root)}"
                  f"{'  (' + r.note + ')' if r.note else ''}")

    print(f"\n{len(results) - len(failed)} processed, {len(failed)} failed")
    print(f"payload  {human(before)} -> {human(after)}   "
          f"saved {human(before - after)} ({pct:.1f}%)")
    print(f"on disk  {human(written)} across {sum(len(r.outputs) for r in results)} "
          f"file(s), including fallbacks")

    for r in failed:
        print(f"  FAILED {r.src}: {r.error}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())