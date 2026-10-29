"""VAL-004 reverse map: planetary windows seen from Earth, and Earth seen from the Moon and Mars.

Pure functions only (numpy). Raster readers live in parallax.reverse.readers so
that these can be tested without GDAL. The measurement is the frozen Parallax
fingerprint: 1 km slope, interior cells, 8 slope classes, base-2 Jensen-Shannon
distance (config/validation/val004_reverse_map_v1.yaml).
"""
from __future__ import annotations

import csv
import math
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np

BIN_LABELS = ("0-1", "1-2", "2-3", "3-5", "5-10", "10-15", "15-20", ">=20")
SLOPE_EDGES = (0.0, 1.0, 2.0, 3.0, 5.0, 10.0, 15.0, 20.0)
WINDOW_CELLS = 50
GRID_M = 1000.0
MOON_RADIUS_M = 1_737_400.0
MARS_RADIUS_M = 3_396_190.0
EARTH_RADIUS_M = 6_371_008.8

CLASSES = ("strong_twin", "twin", "partial", "no_twin")


# --------------------------------------------------------------------------- fingerprint


def block_mean(data: np.ndarray, factor: int) -> np.ndarray:
    """Block-mean aggregation; a block with any NaN becomes NaN (same as the frozen targets)."""
    if factor < 1:
        raise ValueError("Aggregation factor must be >= 1.")
    rows = (data.shape[0] // factor) * factor
    cols = (data.shape[1] // factor) * factor
    blocks = data[:rows, :cols].reshape(rows // factor, factor, cols // factor, factor)
    return blocks.mean(axis=(1, 3))


def slope_degrees(dem: np.ndarray, resolution_m: float = GRID_M) -> np.ndarray:
    dz_dy, dz_dx = np.gradient(dem, resolution_m, resolution_m)
    return np.degrees(np.arctan(np.hypot(dz_dx, dz_dy)))


def histogram(values: np.ndarray) -> np.ndarray:
    """Probabilities over the 8 frozen slope classes (lower edge inclusive, last class open)."""
    values = values[np.isfinite(values)]
    if values.size == 0:
        raise ValueError("No finite slope values.")
    idx = np.searchsorted(np.asarray(SLOPE_EDGES), values, side="right") - 1
    counts = np.bincount(np.clip(idx, 0, len(SLOPE_EDGES) - 1), minlength=len(SLOPE_EDGES)).astype(float)
    return counts / counts.sum()


def window_histogram(elevation: np.ndarray, resolution_m: float = GRID_M) -> np.ndarray:
    """Fingerprint of one complete window: slope on the window's own grid, interior cells only."""
    if elevation.ndim != 2 or min(elevation.shape) < 3:
        raise ValueError("A window needs at least 3 x 3 cells.")
    if not np.isfinite(elevation).all():
        raise ValueError("Incomplete window: every cell must be valid.")
    return histogram(slope_degrees(elevation, resolution_m)[1:-1, 1:-1].ravel())


def sliding_windows(grid: np.ndarray, size: int = WINDOW_CELLS, stride: int = WINDOW_CELLS // 2) -> Iterator[tuple[int, int, np.ndarray]]:
    """Yield (row0, col0, histogram) for every complete size x size window of a 1 km grid.

    Slope is computed per window, so values never borrow cells from outside it,
    exactly as when a single target window is built.
    """
    for r0 in range(0, grid.shape[0] - size + 1, stride):
        for c0 in range(0, grid.shape[1] - size + 1, stride):
            block = grid[r0 : r0 + size, c0 : c0 + size]
            if np.isfinite(block).all():
                yield r0, c0, window_histogram(block)


def window_origin_near(col_f: float, row_f: float, shape: tuple[int, int], size: int = WINDOW_CELLS) -> tuple[int, int]:
    """(row0, col0) of the size x size window whose centre is closest to a point.

    col_f / row_f are the point's position in grid cells from the grid's
    top-left corner. Windows are placed at 1-cell steps and kept inside the
    grid (VAL-004 amendment v1.1, Moon bridge test).
    """
    rows, cols = shape
    if rows < size or cols < size:
        raise ValueError("Grid smaller than one window.")
    c0 = int(round(col_f - size / 2))
    r0 = int(round(row_f - size / 2))
    return min(max(r0, 0), rows - size), min(max(c0, 0), cols - size)


# --------------------------------------------------------------------------- centres on a sphere


def sphere_centres(radius_m: float, stride_m: float, lat_min: float, lat_max: float, window_m: float = 50_000.0) -> list[tuple[float, float]]:
    """Deterministic centres, south to north then west to east.

    Same rule as parallax.data.srtmgl30.candidate_latitudes/longitudes, with the
    radius as a parameter so Mars uses the identical scheme.
    """
    half = math.degrees((window_m / 2) / radius_m)
    step = math.degrees(stride_m / radius_m)
    centres = []
    for lat in np.arange(lat_min + half, lat_max - half + 1e-12, step):
        count = max(1, round(2 * math.pi * radius_m * math.cos(math.radians(lat)) / stride_m))
        lon_step = 360.0 / count
        for k in range(count):
            centres.append((float(lat), float(-180.0 + (k + 0.5) * lon_step)))
    return centres


def great_circle_km(lat1: float, lon1: float, lat2: float, lon2: float, radius_m: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius_m * math.asin(min(1.0, math.sqrt(a))) / 1000


# --------------------------------------------------------------------------- distances


def _normalise(h: np.ndarray) -> np.ndarray:
    h = np.asarray(h, dtype=float)
    if h.ndim == 1:
        h = h[None, :]
    if h.shape[1] != len(BIN_LABELS):
        raise ValueError("Histograms must have 8 bins.")
    if (h < 0).any():
        raise ValueError("Probabilities cannot be negative.")
    s = h.sum(axis=1, keepdims=True)
    if (s <= 0).any():
        raise ValueError("Every histogram needs positive mass.")
    return h / s


def _plogp_ratio(a: np.ndarray, m: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        t = a * np.log2(a / m)
    return np.where(a > 0, t, 0.0)


def jsd_matrix(p: np.ndarray, q: np.ndarray, dtype=np.float64) -> np.ndarray:
    """Base-2 Jensen-Shannon distance between every row of p and every row of q."""
    p = _normalise(p).astype(dtype)[:, None, :]
    q = _normalise(q).astype(dtype)[None, :, :]
    m = 0.5 * (p + q)
    js = 0.5 * (_plogp_ratio(p, m).sum(axis=2) + _plogp_ratio(q, m).sum(axis=2))
    return np.sqrt(np.clip(js, 0.0, None))


def nearest(p: np.ndarray, q: np.ndarray, chunk: int = 32) -> tuple[np.ndarray, np.ndarray]:
    """For each row of p, the index of the closest row of q and its exact (float64) distance.

    The search runs in float32 for speed; the 8 best candidates of each row are
    then re-scored in float64 so near-ties are resolved exactly and
    deterministically (lowest index wins).
    """
    p = _normalise(p)
    q = _normalise(q)
    k = min(8, q.shape[0])
    best_idx = np.empty(p.shape[0], dtype=np.int64)
    best_d = np.empty(p.shape[0], dtype=np.float64)
    for start in range(0, p.shape[0], chunk):
        block = p[start : start + chunk]
        approx = jsd_matrix(block, q, dtype=np.float32)
        cand = np.argpartition(approx, k - 1, axis=1)[:, :k] if k < q.shape[0] else np.tile(np.arange(q.shape[0]), (block.shape[0], 1))
        for i, row in enumerate(cand):
            row = np.sort(row)
            exact = jsd_matrix(block[i], q[row])[0]
            j = int(np.argmin(exact))
            best_idx[start + i] = row[j]
            best_d[start + i] = exact[j]
    return best_idx, best_d


# --------------------------------------------------------------------------- thresholds and classes


@dataclass(frozen=True)
class Thresholds:
    q25: float
    q50: float
    q90: float

    def classify(self, d: float) -> str:
        if not math.isfinite(d):
            raise ValueError("Distance must be finite.")
        if d <= self.q25:
            return "strong_twin"
        if d <= self.q50:
            return "twin"
        if d <= self.q90:
            return "partial"
        return "no_twin"


def validated_pairs(paths: Sequence[Path]) -> list[tuple[str, str, float]]:
    """(site id, body, model-v1 distance to that body's target) for every eligible validated site.

    A site listed in several files, or in one file for several groups, counts
    once per body.
    """
    seen: dict[tuple[str, str], float] = {}
    for path in paths:
        with Path(path).open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["status"] != "eligible":
                    continue
                for group in (g.strip() for g in row["groups"].split(";")):
                    column = {"mars": "jsd_jezero", "moon": "jsd_shackleton"}.get(group)
                    if column is None:
                        raise ValueError(f"Unknown group {group!r} for {row['id']}")
                    seen.setdefault((row["id"], group), float(row[column]))
    return [(site, body, d) for (site, body), d in sorted(seen.items())]


def thresholds_from(distances: Iterable[float]) -> Thresholds:
    d = np.asarray(list(distances), dtype=float)
    if d.size < 5:
        raise ValueError("Too few validated pairs to set thresholds.")
    q25, q50, q90 = np.percentile(d, [25, 50, 90])
    return Thresholds(float(q25), float(q50), float(q90))


def frozen_thresholds(config: dict, root: Path, tolerance: float = 5e-5) -> Thresholds:
    """Recompute the thresholds from the validation files and refuse to run if they disagree with the freeze."""
    t = config["thresholds"]
    pairs = validated_pairs([root / p for p in t["source"]])
    if len(pairs) != t["n_pairs"]:
        raise RuntimeError(f"Expected {t['n_pairs']} validated pairs, found {len(pairs)}.")
    recomputed = thresholds_from(d for _, _, d in pairs)
    frozen = Thresholds(t["q25"], t["q50"], t["q90"])
    for name in ("q25", "q50", "q90"):
        if abs(getattr(recomputed, name) - getattr(frozen, name)) > tolerance:
            raise RuntimeError(f"Threshold {name} recomputes to {getattr(recomputed, name):.5f}, frozen {getattr(frozen, name):.5f}.")
    return frozen


def class_shares(classes: Iterable[str]) -> dict[str, float]:
    classes = list(classes)
    n = len(classes)
    return {c: (sum(1 for x in classes if x == c) / n if n else 0.0) for c in CLASSES}


# --------------------------------------------------------------------------- display


def hillshade(elevation: np.ndarray, resolution_m: float, azimuth_deg: float = 315.0, altitude_deg: float = 30.0, exaggeration: float = 1.0) -> np.ndarray:
    """Shaded relief (0-255) for pictures only. Never used in any measurement."""
    dz_dy, dz_dx = np.gradient(elevation * exaggeration, resolution_m, resolution_m)
    slope = np.arctan(np.hypot(dz_dx, dz_dy))
    aspect = np.arctan2(-dz_dx, dz_dy)
    az, alt = math.radians(azimuth_deg), math.radians(altitude_deg)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(shade * 255, 0, 255).astype(np.uint8)


# --------------------------------------------------------------------------- lookup


def nearest_centre(lat: float, lon: float, centres: np.ndarray, radius_m: float = EARTH_RADIUS_M) -> tuple[int, float]:
    """Index of the closest (lat, lon) centre and its distance in km (haversine)."""
    la = np.radians(centres[:, 0])
    lo = np.radians(centres[:, 1])
    p = math.radians(lat)
    a = np.sin((la - p) / 2) ** 2 + math.cos(p) * np.cos(la) * np.sin((lo - math.radians(lon)) / 2) ** 2
    km = 2 * radius_m * np.arcsin(np.minimum(1.0, np.sqrt(a))) / 1000
    i = int(np.argmin(km))
    return i, float(km[i])
