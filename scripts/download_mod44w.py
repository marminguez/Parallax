"""Download official NASA MOD44W V061 granules for PARALLAX."""

import json
import subprocess
from pathlib import Path


CATALOG = Path(
    "data/earth/mod44w_granules.json"
)

OUTPUT_DIR = Path(
    "data/earth/mod44w/raw"
)

COOKIE_FILE = (
    Path.home() / ".urs_cookies"
)


def load_catalog() -> list[dict]:
    """Load and validate the frozen MOD44W catalog."""

    with CATALOG.open() as f:
        data = json.load(f)

    entries = data["feed"]["entry"]

    if len(entries) != 318:
        raise RuntimeError(
            f"Expected 318 granules, found {len(entries)}."
        )

    return entries


def find_download_url(
    granule: dict,
) -> str:
    """Return the official protected HDF download URL."""

    for link in granule.get("links", []):
        href = link.get("href", "")
        rel = link.get("rel", "")
        title = link.get("title", "")

        if (
            rel.endswith("/data#")
            and href.startswith("https://")
            and href.endswith(".hdf")
            and "lp-prod-protected" in href
            and title.startswith("Download MOD44W")
        ):
            return href

    raise RuntimeError(
        "No protected MOD44W HDF download URL for "
        f"{granule.get('producer_granule_id')!r}"
    )


def download(
    url: str,
    destination: Path,
) -> str:
    """Download one granule, preserving completed local files."""

    if (
        destination.exists()
        and destination.stat().st_size > 0
    ):
        return "existing"

    subprocess.run(
        [
            "curl",
            "-fL",
            "--retry", "8",
            "--retry-all-errors",
            "--retry-delay", "5",
            "--connect-timeout", "30",
            "--netrc",
            "--cookie",
            str(COOKIE_FILE),
            "--cookie-jar",
            str(COOKIE_FILE),
            url,
            "-o",
            str(destination),
        ],
        check=True,
    )

    if (
        not destination.exists()
        or destination.stat().st_size == 0
    ):
        raise RuntimeError(
            f"Download produced no data: {destination}"
        )

    return "downloaded"


def main() -> None:
    """Download all published MOD44W V061 granules."""

    entries = load_catalog()

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    print(
        "PARALLAX — MOD44W V061 DOWNLOAD"
    )
    print("=" * 50)
    print(f"Granules: {len(entries)}")
    print()

    downloaded = 0
    existing = 0

    for index, granule in enumerate(
        entries,
        start=1,
    ):
        url = find_download_url(
            granule
        )

        destination = (
            OUTPUT_DIR
            / Path(url).name
        )

        status = download(
            url,
            destination,
        )

        if status == "downloaded":
            downloaded += 1
            symbol = "↓"
        else:
            existing += 1
            symbol = "✓"

        print(
            f"[{index:03d}/{len(entries):03d}] "
            f"{symbol} {destination.name}"
        )

    print()
    print("=" * 50)
    print(f"Downloaded: {downloaded}")
    print(f"Already present: {existing}")
    print(
        f"Total local HDF: "
        f"{downloaded + existing}"
    )


if __name__ == "__main__":
    main()
