#!/usr/bin/env python3
"""Generate a randomized liquid/swirl pattern PNG.

Usage:
    python swirl.py                       # interactive prompts
    python swirl.py -c "#8B5CF6" -W 1920 -H 1080 -o bg.png
    python swirl.py -c purple --seed 42 --scale 2.5 --coverage 0.45
"""

import argparse
import random

import numpy as np
from PIL import Image, ImageColor

SUPERSAMPLE = 3  # render this many times larger, then downscale for smooth edges


def smoothstep(t):
    # quintic (6t^5 - 15t^4 + 10t^3) rather than cubic: it flattens the
    # second derivative at the lattice lines too, so contour curves bend
    # continuously instead of kinking at every cell boundary
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)


def value_noise(h, w, cells, lattice):
    """Smooth value noise on an h x w grid from a `cells` x `cells` lattice."""
    ys = np.linspace(0, cells, h, endpoint=False)
    xs = np.linspace(0, cells, w, endpoint=False)
    y0, x0 = ys.astype(int), xs.astype(int)
    fy, fx = smoothstep(ys - y0)[:, None], smoothstep(xs - x0)[None, :]

    y0, x0 = y0[:, None], x0[None, :]
    top = lattice[y0, x0] * (1 - fx) + lattice[y0, x0 + 1] * fx
    bot = lattice[y0 + 1, x0] * (1 - fx) + lattice[y0 + 1, x0 + 1] * fx
    return top * (1 - fy) + bot * fy


def fbm(h, w, cells, rng, octaves=5, persistence=0.5):
    """Fractal noise: stacked octaves of value noise, roughly in 0..1.

    `persistence` is how much amplitude each octave keeps relative to the
    one below it. Low values starve the fine octaves, which is what leaves
    the edges as clean sweeping curves rather than jittery ones.
    """
    total = np.zeros((h, w), dtype=np.float64)
    amplitude, norm = 1.0, 0.0
    for i in range(octaves):
        n = max(1, int(cells * 2**i))
        # the lattice is always drawn, even for octaves too faint to matter,
        # so a given seed keeps the same overall layout at any smoothness
        lattice = rng.random((n + 2, n + 2))
        if amplitude > 1e-3:
            total += amplitude * value_noise(h, w, n, lattice)
        norm += amplitude
        amplitude *= persistence
    return total / norm


def laplacian(a):
    """9-point periodic Laplacian; the diagonal terms keep the pattern from
    picking up the square symmetry of the grid."""
    return (
        0.20 * (np.roll(a, 1, 0) + np.roll(a, -1, 0)
                + np.roll(a, 1, 1) + np.roll(a, -1, 1))
        + 0.05 * (np.roll(np.roll(a, 1, 0), 1, 1) + np.roll(np.roll(a, 1, 0), -1, 1)
                  + np.roll(np.roll(a, -1, 0), 1, 1) + np.roll(np.roll(a, -1, 0), -1, 1))
        - a
    )


def gray_scott(h, w, feed, kill, steps, rng):
    """Gray-Scott reaction-diffusion, run to its labyrinth attractor.

    Two chemicals diffuse at different rates while V consumes U. The result
    is stripes of one intrinsic width that wander, fork and terminate in
    round caps -- which is why the lines stay an even weight everywhere.
    """
    u = np.ones((h, w))
    v = np.zeros((h, w))
    seeds = rng.random((h, w)) < 0.03
    u[seeds], v[seeds] = 0.5, 0.25
    u += 0.02 * rng.standard_normal((h, w))

    for _ in range(steps):
        reaction = u * v * v
        u += 0.16 * laplacian(u) - reaction + feed * (1 - u)
        v += 0.08 * laplacian(v) + reaction - (feed + kill) * v
    return v


def fft_upsample(a, out_h, out_w):
    """Band-limited interpolation of a periodic field onto a finer grid.

    The simulation runs on a small grid (stripe width is fixed by the
    physics at ~10 cells), so the field has to be enlarged. Zero-padding
    the spectrum reconstructs it exactly, with none of the faceting that
    bicubic upscaling leaves on a 10x enlargement.

    Every size must be even: the centred spectrum puts DC at n//2, so an
    odd size lands it one bin off, modulating the image by a cosine.
    """
    h, w = a.shape
    spectrum = np.fft.fftshift(np.fft.fft2(a))
    spectrum[0, :] = 0
    spectrum[:, 0] = 0  # unpaired Nyquist bins, dropped to avoid ringing
    padded = np.zeros((out_h, out_w), dtype=complex)
    y0, x0 = (out_h - h) // 2, (out_w - w) // 2
    padded[y0:y0 + h, x0:x0 + w] = spectrum
    scale = (out_h * out_w) / (h * w)
    return np.real(np.fft.ifft2(np.fft.ifftshift(padded))) * scale


def even(n):
    return max(8, int(n) // 2 * 2)


def make_maze(width, height, scale, coverage, feed, kill, steps, rng):
    """Return a bool mask where True = line color."""
    sim_w = even(round(scale * 10.5))
    sim_h = even(round(sim_w * height / width))
    field = gray_scott(sim_h, sim_w, feed, kill, steps, rng)
    field = fft_upsample(field, even(height), even(width))
    # threshold by quantile so `coverage` sets line weight directly
    return field > np.quantile(field, 1.0 - coverage)


def make_pattern(width, height, scale, warp, coverage, smoothness, rng):
    """Return a bool mask where True = swirl color.

    The ribbons are contour bands of a scalar field. The field is a linear
    ramp in a random direction (which gives the ribbons a common flow
    direction) plus fractal noise (which bends, pinches and folds them).
    """
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float64)
    diag = float(max(width, height))
    xn, yn = xx / diag, yy / diag

    angle = rng.uniform(0, 2 * np.pi)
    ramp = xn * np.cos(angle) + yn * np.sin(angle)

    cells = max(1, int(round(scale)))
    persistence = 0.55 * (1.0 - np.clip(smoothness, 0.0, 1.0))
    noise = fbm(height, width, cells, rng, persistence=persistence) - 0.5

    field = (ramp + warp * noise) * scale * 1.6

    # keep only the fractional part: every whole step of the field is one
    # light ribbon plus one dark one, so the bands snake along its contours
    return (field - np.floor(field)) < coverage


def generate(color, background, width, height, args, seed):
    rng = np.random.default_rng(seed)
    # the maze needs less supersampling: the FFT enlargement is already
    # smooth, and 3x on a big canvas costs a lot of memory
    ss = 2 if args.style == "maze" else SUPERSAMPLE
    w, h = width * ss, height * ss

    if args.style == "maze":
        mask = make_maze(w, h, args.scale, args.coverage,
                         args.feed, args.kill, args.steps, rng)
    else:
        mask = make_pattern(w, h, args.scale, args.warp, args.coverage,
                            args.smoothness, rng)

    rgb = np.where(mask[..., None], np.array(color), np.array(background))
    img = Image.fromarray(rgb.astype(np.uint8), "RGB")
    return img.resize((width, height), Image.LANCZOS)


def parse_color(text, fallback=None):
    text = text.strip()
    if not text and fallback:
        return fallback
    return ImageColor.getrgb(text)


def main():
    p = argparse.ArgumentParser(description="Generate a randomized swirly PNG.")
    p.add_argument("-c", "--color", help="swirl color: hex (#8B5CF6) or name (purple)")
    p.add_argument("-b", "--background", help="background color (default #0A0A0A)")
    p.add_argument("-W", "--width", type=int, help="width in pixels")
    p.add_argument("-H", "--height", type=int, help="height in pixels")
    p.add_argument("-o", "--output", default="swirl.png", help="output file")
    p.add_argument("-s", "--style", choices=("bands", "maze"), default="bands",
                   help="bands = thick flowing ribbons; maze = even-weight "
                        "labyrinth lines (default bands)")
    p.add_argument("--scale", type=float, default=2.0,
                   help="bands: feature density, lower = bigger swirls. "
                        "maze: roughly how many lines span the width. "
                        "(default 2.0, try 12 for maze)")
    p.add_argument("--warp", type=float, default=0.55,
                   help="how much the shapes get stretched and folded (default 0.55)")
    p.add_argument("--smoothness", type=float, default=1,
                   help="0 = jagged, crinkly edges; 1 = clean sweeping curves "
                        "(default 0.7)")
    p.add_argument("--coverage", type=float, default=0.5,
                   help="fraction of the canvas covered by the swirl color (default 0.5)")
    p.add_argument("--steps", type=int, default=6000,
                   help="maze only: relaxation iterations; more = cleaner, "
                        "more settled lines (default 6000)")
    p.add_argument("--feed", type=float, default=0.029,
                   help="maze only: Gray-Scott feed rate (default 0.029)")
    p.add_argument("--kill", type=float, default=0.057,
                   help="maze only: Gray-Scott kill rate (default 0.057)")
    p.add_argument("--seed", type=int, help="reuse a seed to reproduce a pattern")
    p.add_argument("--invert", action="store_true", help="swap the two colors")
    args = p.parse_args()

    color_text = args.color or input("Swirl color (hex or name) [#8B5CF6]: ")
    color = parse_color(color_text, fallback=(139, 92, 246))
    background = parse_color(args.background or "", fallback=(10, 10, 10))

    width = args.width or int(input("Width in px [1920]: ").strip() or 1920)
    height = args.height or int(input("Height in px [1080]: ").strip() or 1080)

    if args.invert:
        color, background = background, color

    seed = args.seed if args.seed is not None else random.randrange(2**31)
    if args.style == "maze" and args.scale < 4:
        args.scale = 12.0   # `bands` default is meaningless here
    img = generate(color, background, width, height, args, seed)
    img.save(args.output)
    print(f"Saved {args.output}  ({width}x{height}, seed {seed})")


if __name__ == "__main__":
    main()