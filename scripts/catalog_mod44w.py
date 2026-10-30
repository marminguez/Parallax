"""Build the official NASA MOD44W V061 granule catalog for PARALLAX."""

import json
import re
import urllib.request
from pathlib import Path


COLLECTION_CONCEPT_ID = "C2565805847-LPCLOUD"

CMR_URL = (
    "https://cmr.earthdata.nasa.gov/search/granules.json"
    f"?collection_concept_id={COLLECTION_CONCEPT_ID}"
    "&temporal=2000-01-01T00:00:00Z,2000-01-02T00:00:00Z"
    "&page_size=2000"
)

CATALOG = Path("data/earth/mod44w_granules.json")

TILE_PATTERN = re.compile(
    r"\.(h\d{2}v\d{2})\."
)


def tile_id(granule: dict) -> str:
    """Extract hXXvYY from an official MOD44W producer granule ID."""
    producer_id = granule.get(
        "producer_granule_id",
        "",
    )

    match = TILE_PATTERN.search(
        producer_id
    )

    if not match:
        raise RuntimeError(
            "Could not extract MODIS tile from "
            f"{producer_id!r}"
        )

    return match.group(1)


def get_catalog() -> list[dict]:
    """Query and persist the official MOD44W V061 CMR catalog."""
    print("Querying NASA CMR...")

    with urllib.request.urlopen(
        CMR_URL
    ) as response:
        data = json.load(response)

    entries = data["feed"]["entry"]

    if len(entries) != 318:
        raise RuntimeError(
            f"Expected 318 granules, found {len(entries)}"
        )

    tiles = [
        tile_id(entry)
        for entry in entries
    ]

    if len(set(tiles)) != 318:
        raise RuntimeError(
            "MOD44W catalog does not contain "
            "318 unique tile IDs."
        )

    CATALOG.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with CATALOG.open("w") as f:
        json.dump(
            data,
            f,
            indent=2,
        )

    return entries


def main():
    entries = get_catalog()

    tiles = sorted(
        tile_id(entry)
        for entry in entries
    )

    print()
    print("PARALLAX — MOD44W V061 CATALOG")
    print("=" * 50)
    print(f"Granules:     {len(entries)}")
    print(f"Unique tiles: {len(tiles)}")
    print(f"First tile:   {tiles[0]}")
    print(f"Last tile:    {tiles[-1]}")
    print(f"Catalog:      {CATALOG}")


if __name__ == "__main__":
    main()
