"""Extract all official MOD44W V061 water masks to native GeoTIFF."""

import re
from pathlib import Path

from parallax.data.mod44w import extract_water_mask


RAW_DIR = Path("data/earth/mod44w/raw")
OUTPUT_DIR = Path("data/earth/mod44w/processed")

TILE_PATTERN = re.compile(
    r"\.(h\d{2}v\d{2})\."
)


def tile_id(path: Path) -> str:
    """Extract hXXvYY from a MOD44W HDF filename."""

    match = TILE_PATTERN.search(path.name)

    if not match:
        raise RuntimeError(
            f"Could not extract tile ID from {path.name!r}"
        )

    return match.group(1)


def main() -> None:
    """Extract every locally downloaded MOD44W water mask."""

    hdf_files = sorted(
        RAW_DIR.glob("MOD44W.A2000001.*.hdf")
    )

    if len(hdf_files) != 318:
        raise RuntimeError(
            f"Expected 318 HDF files, found {len(hdf_files)}."
        )

    tiles = [
        tile_id(path)
        for path in hdf_files
    ]

    if len(set(tiles)) != 318:
        raise RuntimeError(
            "Expected 318 unique MOD44W tile IDs."
        )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    extracted = 0
    existing = 0

    print(
        "PARALLAX — MOD44W WATER MASK EXTRACTION"
    )
    print("=" * 50)
    print(f"HDF granules: {len(hdf_files)}")
    print()

    for index, hdf_path in enumerate(
        hdf_files,
        start=1,
    ):
        tile = tile_id(hdf_path)

        output_path = (
            OUTPUT_DIR
            / f"MOD44W_{tile}_native.tif"
        )

        if (
            output_path.exists()
            and output_path.stat().st_size > 0
        ):
            existing += 1
            symbol = "✓"
        else:
            extract_water_mask(
                hdf_path,
                output_path,
            )
            extracted += 1
            symbol = "↓"

        print(
            f"[{index:03d}/{len(hdf_files):03d}] "
            f"{symbol} {tile}"
        )

    print()
    print("=" * 50)
    print(f"Extracted: {extracted}")
    print(f"Already present: {existing}")
    print(
        f"Total native masks: "
        f"{extracted + existing}"
    )


if __name__ == "__main__":
    main()
