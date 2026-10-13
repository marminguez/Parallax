"""Offline, display-only place labels for analysis-window centres.

Labels come from the nearest GeoNames populated place (population >= 1000).
They are attached to results *after* ranking and never influence matching,
filtering or ordering (EXP-001 guardrail: ``place_names_used_for_ranking:
false``). A label describes the nearest settlement, not the extent of a
50 x 50 km window, and remote windows may be far from any settlement.

Data: GeoNames ``cities1000`` snapshot as redistributed in reverse_geocoder
1.5.1 (2015), trimmed to lat, lon, name, admin1 and country code.
GeoNames data is licensed CC BY 4.0 — https://www.geonames.org/
"""
from __future__ import annotations

import csv
import gzip
import math
from functools import lru_cache
from pathlib import Path

import numpy as np

DATA_FILE = Path(__file__).with_name("geonames_cities1000.csv.gz")
SOURCE = "GeoNames cities1000 (2015 snapshot via reverse_geocoder 1.5.1)"
ATTRIBUTION = "Place names © GeoNames (geonames.org), CC BY 4.0"
METHOD = "Nearest populated place (population ≥ 1000) to the window centre, great-circle distance. Display only; not used in ranking."
EARTH_RADIUS_KM = 6371.0088


@lru_cache(maxsize=1)
def _table():
    lats, lons, names, admin1, countries = [], [], [], [], []
    with gzip.open(DATA_FILE, "rt", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            lats.append(float(row["lat"]))
            lons.append(float(row["lon"]))
            names.append(row["name"])
            admin1.append(row["admin1"])
            countries.append(row["cc"])
    return np.radians(np.array(lats)), np.radians(np.array(lons)), names, admin1, countries


def describe(lat: float, lon: float) -> dict:
    """Return the nearest populated place to ``(lat, lon)`` with its distance."""
    if not (math.isfinite(lat) and math.isfinite(lon) and -90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Coordinates must be finite latitude/longitude in degrees.")
    lat_r, lon_r, names, admin1, countries = _table()
    p_lat, p_lon = math.radians(lat), math.radians(lon)
    h = np.sin((lat_r - p_lat) / 2) ** 2 + math.cos(p_lat) * np.cos(lat_r) * np.sin((lon_r - p_lon) / 2) ** 2
    index = int(np.argmin(h))
    distance = 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(min(1.0, float(h[index]))))
    return {
        "nearest": names[index],
        "admin1": admin1[index],
        "countryCode": countries[index],
        "distanceKm": round(distance, 1),
        "source": SOURCE,
        "attribution": ATTRIBUTION,
        "method": METHOD,
    }
