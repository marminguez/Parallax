import json
from pathlib import Path

import pytest

from parallax.places import describe


def test_known_window_centre_is_labelled_from_bundled_geonames():
    place = describe(43.0, -3.0)
    assert place["countryCode"] == "ES"
    assert place["admin1"] == "Basque Country"
    assert place["distanceKm"] < 5


def test_remote_points_report_large_distances_instead_of_a_wrong_region():
    place = describe(-75.0, 0.0)
    assert place["distanceKm"] > 500


@pytest.mark.parametrize("lat,lon", [(91, 0), (0, 181), (float("nan"), 0)])
def test_invalid_coordinates_are_rejected(lat, lon):
    with pytest.raises(ValueError):
        describe(lat, lon)


def test_bundled_index_labels_cover_every_measured_window():
    root = Path(__file__).resolve().parents[1]
    lines = (root / "web/data/earth-candidates.csv").read_text().strip().splitlines()[1:]
    ids = [line.split(",")[0] for line in lines]
    places = json.loads((root / "web/data/earth-candidate-places.json").read_text(encoding="utf-8"))["places"]
    assert set(ids) == set(places)
