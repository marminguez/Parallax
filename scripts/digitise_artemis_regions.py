"""Digitise the nine Artemis III region centres from NASA's official map (28 Oct 2024).

NASA publishes the regions only as yellow boxes on a south-polar image without a
lat/lon grid. This script records how the centres in
config/validation/val004_overlays_v1.yaml were obtained, so anyone can redo it:

  1. Download https://www.nasa.gov/wp-content/uploads/2024/10/artemis-iii-landing-region-candidates.jpg
  2. python scripts/digitise_artemis_regions.py --image path/to/that.jpg
     (without --image it converts the recorded box centres and runs the checks)

Calibration uses the map's own marks: the green South Pole star (origin), the
50 km scale bar (181 px) and the polar-stereographic convention 0 deg longitude
up / 90 E right, confirmed by IAU crater centres (Nobile, de Gerlache, Shackleton).
"""
from __future__ import annotations

import argparse
import math

R_KM = 1737.4
POLE_PX = (745.84, 762.34)       # green star, measured
PX_PER_KM = 181 / 50             # scale bar 0-50 km = 181 px
# Box centres = midpoints of the yellow outline (measured from the 1430 x 1105 image).
BOXES = {
    "peak-near-cabeus-b": (102.5, 511.0),
    "haworth": (611.0, 437.5),
    "malapert-massif": (745.0, 326.0),
    "mons-mouton-plateau": (1059.75, 231.75),
    "mons-mouton": (1008.25, 339.5),
    "nobile-rim-1": (1047.5, 367.5),
    "nobile-rim-2": (1309.0, 421.5),
    "de-gerlache-rim-2": (573.0, 679.0),
    "slater-plain": (997.5, 940.5),
}
# IAU / Gazetteer of Planetary Nomenclature crater centres used as checks.
CHECKS = {"nobile": (-85.28, 53.27, 79.27), "de_gerlache": (-88.5, -87.1, 32.4), "shackleton": (-89.67, 129.78, 20.92)}


def px_to_latlon(x: float, y: float, pole=POLE_PX, scale=PX_PER_KM) -> tuple[float, float]:
    east, north = (x - pole[0]) / scale, (pole[1] - y) / scale
    c = 2 * math.atan(math.hypot(east, north) / (2 * R_KM))
    return -(90 - math.degrees(c)), math.degrees(math.atan2(east, north))


def latlon_to_px(lat: float, lon: float, pole=POLE_PX, scale=PX_PER_KM) -> tuple[float, float]:
    rho = 2 * R_KM * math.tan(math.radians(90 + lat) / 2)
    return pole[0] + rho * math.sin(math.radians(lon)) * scale, pole[1] - rho * math.cos(math.radians(lon)) * scale


def measure(image: str) -> None:
    """Print yellow outline components and the green star centroid, to re-measure BOXES and POLE_PX."""
    import numpy as np
    from PIL import Image
    from scipy import ndimage

    im = np.asarray(Image.open(image).convert("RGB")).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    lab, _ = ndimage.label((r > 200) & (g > 200) & (b < 90))
    for ys, xs in ndimage.find_objects(lab):
        if ys.stop - ys.start > 20 and xs.stop - xs.start > 20:
            print(f"yellow outline x {xs.start}-{xs.stop - 1}  y {ys.start}-{ys.stop - 1} (overlapping boxes merge: split them by their lines)")
    sy, sx = np.nonzero((g > 150) & (r < 120) & (b < 120))
    print(f"green star centroid ({sx.mean():.2f}, {sy.mean():.2f})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--image")
    args = parser.parse_args()
    if args.image:
        measure(args.image)
    for k, (x, y) in BOXES.items():
        lat, lon = px_to_latlon(x, y)
        print(f"{k:22s} lat {lat:7.2f}  lon {lon:8.2f}")
    nx, ny = latlon_to_px(*CHECKS["nobile"][:2])
    for k in ("nobile-rim-1", "nobile-rim-2"):
        d = math.hypot(BOXES[k][0] - nx, BOXES[k][1] - ny) / PX_PER_KM
        print(f"check: {k} is {d:.1f} km from Nobile's centre (crater radius {CHECKS['nobile'][2] / 2:.1f} km)")


if __name__ == "__main__":
    main()
