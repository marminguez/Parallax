"""Download NASA SRTMGL30 V002 for PARALLAX EXP-001B."""

import json
import subprocess
import urllib.request
from pathlib import Path


CMR_URL = (
    "https://cmr.earthdata.nasa.gov/search/granules.json"
    "?short_name=SRTMGL30"
    "&version=002"
    "&page_size=100"
)

OUTPUT_DIR = Path("data/earth/coarse/raw")
CATALOG = Path("data/earth/srtmgl30_granules.json")


def get_catalog():
    print("Querying NASA CMR...")

    with urllib.request.urlopen(CMR_URL) as response:
        data = json.load(response)

    entries = data["feed"]["entry"]

    if len(entries) != 27:
        raise RuntimeError(
            f"Expected 27 granules, found {len(entries)}"
        )

    CATALOG.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with CATALOG.open("w") as f:
        json.dump(data, f, indent=2)

    return entries


def find_download_url(granule):
    for link in granule.get("links", []):
        href = link.get("href", "")
        rel = link.get("rel", "")

        if (
            rel.endswith("/data#")
            and href.startswith("https://")
            and href.endswith(".zip")
            and "lp-prod-protected" in href
        ):
            return href

    return None


def download(url, destination):
    if destination.exists():
        print(
            f"  ✓ Already exists: "
            f"{destination.name}"
        )
        return

    print(f"  ↓ {destination.name}")

    subprocess.run(
        [
            "curl",
            "-fL",
            "--retry", "3",
            "--netrc",
            "--cookie",
            str(Path.home() / ".urs_cookies"),
            "--cookie-jar",
            str(Path.home() / ".urs_cookies"),
            url,
            "-o",
            str(destination),
        ],
        check=True,
    )


def main():
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    entries = get_catalog()

    print()
    print("PARALLAX — SRTMGL30 DOWNLOAD")
    print("=" * 50)
    print(f"Granules: {len(entries)}")
    print()

    downloaded = 0

    for index, granule in enumerate(
        entries,
        start=1,
    ):
        title = granule["title"]

        url = find_download_url(
            granule
        )

        if not url:
            raise RuntimeError(
                f"No download URL for {title}"
            )

        filename = Path(
            url
        ).name

        destination = (
            OUTPUT_DIR /
            filename
        )

        print(
            f"[{index:02d}/{len(entries):02d}] "
            f"{title}"
        )

        download(
            url,
            destination,
        )

        downloaded += 1

    print()
    print("=" * 50)
    print(
        f"✓ Catalog contains "
        f"{downloaded} granules"
    )
    print(
        f"✓ Data directory: "
        f"{OUTPUT_DIR}"
    )


if __name__ == "__main__":
    main()
