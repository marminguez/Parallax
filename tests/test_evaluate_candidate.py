"""Tests for EXP-001B candidate terrain evaluation."""

import importlib.util
from pathlib import Path

import numpy as np


SCRIPT_PATH = Path(
    "scripts/evaluate_candidate.py"
)

spec = importlib.util.spec_from_file_location(
    "evaluate_candidate",
    SCRIPT_PATH,
)

evaluator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evaluator)


def test_land_slope_stencil_requires_center_and_cardinal_neighbors():
    land = np.ones(
        (5, 5),
        dtype=bool,
    )

    land[2, 3] = False

    valid = evaluator.land_slope_stencil(
        land
    )

    expected = np.zeros(
        (5, 5),
        dtype=bool,
    )

    expected[1, 1] = True
    expected[1, 2] = True
    expected[2, 1] = True
    expected[3, 1] = True
    expected[3, 2] = True

    assert np.array_equal(
        valid,
        expected,
    )


def test_slope_histogram_respects_valid_mask():
    slope = np.array([
        [0.5, 0.5, 0.5],
        [0.5, 7.0, 0.5],
        [0.5, 0.5, 0.5],
    ])

    valid = np.zeros(
        (3, 3),
        dtype=bool,
    )
    valid[1, 1] = True

    histogram = evaluator.slope_histogram(
        slope,
        valid_mask=valid,
    )

    expected = np.array([
        0.0,
        0.0,
        0.0,
        0.0,
        1.0,
        0.0,
        0.0,
        0.0,
    ])

    assert np.array_equal(
        histogram,
        expected,
    )
