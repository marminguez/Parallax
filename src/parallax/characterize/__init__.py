"""Twin characterization v1: pure functions (numpy only).

Frozen configuration: config/characterization/dimensions_v1.yaml. Descriptive only:
nothing here changes the VAL-004 ranking. Raster and network access live in
parallax.characterize.sources so these functions can be tested without GDAL.
"""
from __future__ import annotations

import math
from collections.abc import Sequence

import numpy as np

from parallax.matching.similarity import jensen_shannon_distance
from parallax.reverse import histogram, slope_degrees

FINE_GRID_M = 60.0
FINE_CELLS = 833
ROVER_SLOPE_DEG = 15.0
MIN_VALID_SHARE = 0.9

FINE_BANDS = (0.10, 0.30)          # holds <= 0.10 < partly <= 0.30 < breaks
TEMPERATURE_BANDS = (0.20, 0.50)   # breaks < 0.20 <= partly < 0.50 <= holds
POPULATION_BANDS = (1.0, 25.0)     # remote < 1 <= rural < 25 <= populated

PLANET_TEMPERATURE_C = {"moon": (-203.0, 54.0), "mars": (-83.0, -13.0)}


# --------------------------------------------------------------------------- fine relief


def fine_fingerprint(elevation: np.ndarray, resolution_m: float = FINE_GRID_M) -> dict:
    """Slope fingerprint of a fine window that may contain gaps (NaN).

    Slopes are computed on the full grid; only interior cells whose 3 x 3
    neighbourhood is complete count. Returns the 8-class histogram, the share of
    cells at or above the rover slope and the share of valid cells.
    """
    if elevation.ndim != 2 or min(elevation.shape) < 3:
        raise ValueError("A window needs at least 3 x 3 cells.")
    slopes = slope_degrees(elevation, resolution_m)[1:-1, 1:-1]
    finite = np.isfinite(elevation)
    complete = np.ones_like(finite[1:-1, 1:-1])
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            complete &= finite[1 + dr:finite.shape[0] - 1 + dr, 1 + dc:finite.shape[1] - 1 + dc]
    valid = slopes[complete & np.isfinite(slopes)]
    share = valid.size / complete.size
    if valid.size == 0:
        return {"valid_share": 0.0, "histogram": None, "steep_share": None}
    return {
        "valid_share": round(float(share), 4),
        "histogram": [round(float(v), 6) for v in histogram(valid)],
        "steep_share": round(float((valid >= ROVER_SLOPE_DEG).mean()), 4),
    }


def fine_verdict(distance: float) -> str:
    holds, partly = FINE_BANDS
    return "holds" if distance <= holds else "partly" if distance <= partly else "breaks"


def fine_relief(earth: dict | None, planet: dict | None) -> dict:
    """Compare two fine fingerprints; a side below the valid-share floor is not measured."""
    def usable(side: dict | None) -> bool:
        return bool(side and side.get("histogram") and side["valid_share"] >= MIN_VALID_SHARE)

    out: dict = {"earth": earth, "planet": planet}
    if not usable(earth) or not usable(planet):
        out["status"] = "not_measured"
        out["reason"] = "earth" if not usable(earth) else "planet"
        return out
    d = jensen_shannon_distance(earth["histogram"], planet["histogram"])
    out.update(status="measured", distance=round(d, 4), verdict=fine_verdict(d))
    return out


# --------------------------------------------------------------------------- temperature


def overlap_share(earth_range: tuple[float, float], planet_range: tuple[float, float]) -> float:
    """Share of the planet's temperature range that the Earth range covers (0..1)."""
    e0, e1 = sorted(earth_range)
    p0, p1 = sorted(planet_range)
    if p1 <= p0:
        raise ValueError("Planet range must have positive width.")
    return max(0.0, min(e1, p1) - max(e0, p0)) / (p1 - p0)


def temperature_verdict(share: float) -> str:
    breaks, partly = TEMPERATURE_BANDS
    return "breaks" if share < breaks else "partly" if share < partly else "holds"


def power_extremes(payload: dict) -> tuple[float, float]:
    """Coldest monthly mean of daily minimum and warmest monthly mean of daily maximum from a NASA POWER climatology response."""
    params = payload["properties"]["parameter"]
    months = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
    fill = payload.get("header", {}).get("fill_value", -999.0)

    def series(name: str) -> list[float]:
        if name not in params:
            raise KeyError(f"NASA POWER response has no {name}.")
        vals = [float(params[name][m]) for m in months if m in params[name]]
        vals = [v for v in vals if v != fill and v > -900]
        if len(vals) < 12:
            raise ValueError(f"NASA POWER {name}: {len(vals)} valid months, need 12.")
        return vals

    return min(series("TS_MIN")), max(series("TS_MAX"))


def temperature(earth_range: tuple[float, float], body: str) -> dict:
    planet = PLANET_TEMPERATURE_C[body]
    share = overlap_share(earth_range, planet)
    colder = planet[0] < earth_range[0]
    return {
        "status": "measured",
        "earth_c": [round(earth_range[0], 1), round(earth_range[1], 1)],
        "planet_c": list(planet),
        "overlap": round(share, 3),
        "verdict": temperature_verdict(share),
        "planet_colder_by_c": round(earth_range[0] - planet[0], 1) if colder else 0.0,
    }


# --------------------------------------------------------------------------- operations


def population_verdict(mean_density: float) -> str:
    remote, rural = POPULATION_BANDS
    return "remote" if mean_density < remote else "rural" if mean_density < rural else "populated"


def operations(densities: np.ndarray, nearest_km: float | None) -> dict:
    vals = np.asarray(densities, float)
    vals = vals[np.isfinite(vals) & (vals >= 0)]
    if vals.size == 0:
        return {"status": "not_measured", "reason": "no population cells", "nearest_settlement_km": nearest_km}
    mean = float(vals.mean())
    return {
        "status": "measured",
        "population_mean_km2": round(mean, 2),
        "population_max_km2": round(float(vals.max()), 1),
        "cells": int(vals.size),
        "nearest_settlement_km": nearest_km,
        "verdict": population_verdict(mean),
    }


def window_bounds_deg(lat: float, lon: float, half_km: float = 25.0) -> tuple[float, float, float, float]:
    """Lon/lat box of a square window on the WGS84 sphere approximation (west, south, east, north)."""
    dlat = half_km / 111.32
    dlon = half_km / (111.32 * max(0.05, math.cos(math.radians(lat))))
    return lon - dlon, lat - dlat, lon + dlon, lat + dlat


def copernicus_tile_names(west: float, south: float, east: float, north: float) -> list[str]:
    """Copernicus DEM GLO-30 tile names covering a lon/lat box (1 degree tiles, named by their south-west corner)."""
    names = []
    for la in range(math.floor(south), math.floor(north) + 1):
        for lo in range(math.floor(west), math.floor(east) + 1):
            lo_w = ((lo + 180) % 360) - 180
            ns = f"N{la:02d}" if la >= 0 else f"S{-la:02d}"
            ew = f"E{lo_w:03d}" if lo_w >= 0 else f"W{-lo_w:03d}"
            names.append(f"Copernicus_DSM_COG_10_{ns}_00_{ew}_00_DEM")
    return names


# --------------------------------------------------------------------------- ice (characterization v1.1)

PSR_SIGNAL = 0.01          # Moon: share of the window in permanent shadow
SWIM_SIGNAL = 0.25         # Mars: share of cells needed for an ice signal
SWIM_CLEAR = 0.25          # v1.2 amendment: a cell counts only at consistency >= 0.25 (v1.1 counted > 0)
PZI_LEVEL, PZI_SIGNAL = 0.5, 0.25  # Earth: share of cells with permafrost zonation index >= 0.5


def _finite(values) -> np.ndarray:
    v = np.asarray(values, float).ravel()
    return v[np.isfinite(v)]


def moon_ice(psr_values) -> dict:
    v = _finite(psr_values)
    v = v[(v >= 0) & (v <= 1)]
    if v.size == 0:
        return {"status": "not_measured"}
    share = float((v > 0.5).mean())
    return {"status": "measured", "psr_share": round(share, 4), "signal": share >= PSR_SIGNAL}


def mars_ice(swim_values) -> dict:
    v = _finite(swim_values)
    v = v[(v >= -1) & (v <= 1)]  # SWIM no-data is -30
    if v.size == 0:
        return {"status": "not_measured", "reason": "outside SWIM coverage (60 S to 60 N)"}
    positive = float((v > 0).mean())
    clear = float((v >= SWIM_CLEAR).mean())
    return {"status": "measured", "swim_mean": round(float(v.mean()), 3),
            "swim_positive_share": round(positive, 4), "swim_clear_share": round(clear, 4),
            "signal": clear >= SWIM_SIGNAL, "signal_v1_1": positive >= SWIM_SIGNAL}


def earth_ice(pzi_values) -> dict:
    raw = _finite(pzi_values)
    v = raw[(raw >= 0) & (raw <= 1)]
    if v.size == 0 and (raw > 1).any():
        raise ValueError(f"Permafrost index outside 0..1 (max {raw.max():.3g}): check the raster's scale.")
    if v.size == 0:
        return {"status": "measured", "pzi_mean": 0.0, "pzi_share": 0.0, "signal": False, "note": "no permafrost cells in the window"}
    share = float((v >= PZI_LEVEL).mean())
    return {"status": "measured", "pzi_mean": round(float(v.mean()), 3), "pzi_share": round(share, 4), "signal": share >= PZI_SIGNAL}


def ice(destination: dict, earth: dict) -> dict:
    """Combine the two sides into the frozen verdict (holds / breaks / none / earth_only)."""
    out = {"destination": destination, "earth": earth}
    if destination.get("status") != "measured" or earth.get("status") != "measured":
        out["status"] = "not_measured"
        out["reason"] = destination.get("reason") or ("destination" if destination.get("status") != "measured" else "earth")
        return out
    def verdict(d: bool, e: bool) -> str:
        return "holds" if d and e else "breaks" if d else "earth_only" if e else "none"

    out["status"] = "measured"
    out["verdict"] = verdict(destination["signal"], earth["signal"])
    if "signal_v1_1" in destination:  # Mars: keep the frozen v1.1 verdict beside the v1.2 one
        out["verdict_v1_1"] = verdict(destination["signal_v1_1"], earth["signal"])
    return out


# --------------------------------------------------------------------------- bare ground (characterization v1.3)

GROUND_BANDS = (0.20, 0.50)        # breaks < 0.20 <= partly < 0.50 <= holds (share of bare ground)
GROUND_MIN_COVERAGE = 0.9
WORLDCOVER_BARE, WORLDCOVER_SNOW = 60, 70
WORLDCOVER_VEGETATED = (10, 20, 30, 40, 90, 95, 100)


def ground(classes: dict[int, int], total_samples: int) -> dict:
    """Bare-ground verdict from WorldCover sample counts per class code (config/characterization/ground_v1.yaml)."""
    classified = sum(classes.values())
    coverage = classified / total_samples if total_samples else 0.0
    if classified == 0 or coverage < GROUND_MIN_COVERAGE:
        return {"status": "not_measured", "reason": "WorldCover covers too little of the window", "coverage": round(coverage, 3)}
    share = lambda codes: sum(classes.get(c, 0) for c in codes) / classified  # noqa: E731
    bare = share((WORLDCOVER_BARE,))
    breaks, partly = GROUND_BANDS
    return {
        "status": "measured",
        "coverage": round(coverage, 3),
        "bare_share": round(bare, 4),
        "snow_ice_share": round(share((WORLDCOVER_SNOW,)), 4),
        "vegetated_share": round(share(WORLDCOVER_VEGETATED), 4),
        "dominant_class": max(classes, key=lambda c: classes[c]),
        "verdict": "breaks" if bare < breaks else "partly" if bare < partly else "holds",
    }


# --------------------------------------------------------------------------- geology (characterization v1.4)

GLIM_CODES = ("su", "ss", "sm", "sc", "ev", "py", "va", "vi", "vb", "pa", "pi", "pb", "mt", "ig", "wb", "nd")
GEOLOGY_FAMILIES = {
    "crystalline_feldspathic": {"match": ("pb",), "family": ("pb", "pi", "pa", "mt")},
    "basaltic_volcanic": {"match": ("vb",), "family": ("vb", "vi", "va", "py")},
    "basaltic_crust": {"match": ("vb",), "family": ("vb", "vi", "va", "py", "pb", "pi", "pa", "mt")},
    "sedimentary": {"match": ("ss", "sm", "su"), "family": ("ss", "sm", "su", "sc", "ev")},
    "polar": {"match": ("ig",), "family": ("ig", "su")},
}
MARS_UNIT_GROUPS = {"v": "basaltic_volcanic", "h": "basaltic_crust", "i": "basaltic_crust", "a": "basaltic_crust",
                    "t": "sedimentary", "l": "sedimentary", "b": "sedimentary", "p": "polar"}
MOON_FAMILY = "crystalline_feldspathic"
GEOLOGY_HOLDS = 0.5


def mars_unit_family(unit: str) -> str:
    """Rock family of a SIM 3292 unit symbol: strip the age prefix, read the group letter."""
    import re

    m = re.match(r"^[eml]?[NHA]+([a-z])", unit or "")
    if not m or m.group(1) not in MARS_UNIT_GROUPS:
        raise ValueError(f"Unknown Mars unit symbol: {unit!r}")
    return MARS_UNIT_GROUPS[m.group(1)]


def box_class_weights(grid: np.ndarray, west0: float, north0: float, cell: float,
                      box: tuple[float, float, float, float]) -> dict[int, float]:
    """Overlap weight (degrees squared x cos latitude) of each grid value with a lon/lat box (west, south, east, north).

    grid[0, 0] is the cell whose north-west corner is (west0, north0); cells are square of size `cell` degrees.
    """
    west, south, east, north = box
    weights: dict[int, float] = {}
    rows, cols = grid.shape
    r0, r1 = max(0, int(math.floor((north0 - north) / cell))), min(rows - 1, int(math.floor((north0 - south) / cell)))
    for r in range(r0, r1 + 1):
        top, bottom = north0 - r * cell, north0 - (r + 1) * cell
        dy = min(top, north) - max(bottom, south)
        if dy <= 0:
            continue
        coslat = math.cos(math.radians((top + bottom) / 2))
        for lon_w, lon_e in ((west, east),) if west >= -180 and east <= 180 else _split_lon(west, east):
            c0, c1 = max(0, int(math.floor((lon_w - west0) / cell))), min(cols - 1, int(math.floor((lon_e - west0) / cell)))
            for c in range(c0, c1 + 1):
                left = west0 + c * cell
                dx = min(left + cell, lon_e) - max(left, lon_w)
                if dx > 0:
                    v = int(grid[r, c])
                    weights[v] = weights.get(v, 0.0) + dx * dy * coslat
    return weights


def _split_lon(west: float, east: float) -> list[tuple[float, float]]:
    if west < -180:
        return [(west + 360, 180.0), (-180.0, east)]
    return [(west, 180.0), (-180.0, east - 360)]


def geology(family: str, class_weights: dict[str, float]) -> dict:
    """Frozen verdict (config/characterization/geology_v1.yaml) from Earth class weights in the twin window."""
    spec = GEOLOGY_FAMILIES[family]
    valid = {k: w for k, w in class_weights.items() if k in GLIM_CODES and k != "nd" and w > 0}
    total = sum(valid.values())
    if total <= 0:
        return {"status": "not_measured", "reason": "no valid GLiM cell in the window", "family": family}
    shares = {k: round(w / total, 4) for k, w in sorted(valid.items(), key=lambda kv: -kv[1])}
    match = sum(shares.get(k, 0.0) for k in spec["match"])
    fam = sum(shares.get(k, 0.0) for k in spec["family"])
    verdict = "holds" if match >= GEOLOGY_HOLDS else "partly" if fam >= GEOLOGY_HOLDS else "breaks"
    return {"status": "measured", "family": family, "earth_classes": shares, "earth_dominant": next(iter(shares)),
            "match_share": round(match, 4), "family_share": round(fam, 4), "verdict": verdict}
