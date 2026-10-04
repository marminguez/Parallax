import numpy as np

from parallax.matching.similarity import jensen_shannon_distance

def test_identical_distributions_have_zero_distance():
    p = [0.3364, 0.2592, 0.1436, 0.1300,
         0.0952, 0.0220, 0.0124, 0.0012]

    assert np.isclose(
        jensen_shannon_distance(p, p),
        0.0,
    )


def test_distance_is_symmetric():
    p = [0.8, 0.2, 0.0]
    q = [0.2, 0.7, 0.1]

    assert np.isclose(
        jensen_shannon_distance(p, q),
        jensen_shannon_distance(q, p),
    )


def test_maximally_separated_distributions_equal_one():
    p = [1.0, 0.0]
    q = [0.0, 1.0]

    assert np.isclose(
        jensen_shannon_distance(p, q),
        1.0,
    )


def test_distance_is_bounded():
    p = [0.5, 0.3, 0.2]
    q = [0.1, 0.2, 0.7]

    distance = jensen_shannon_distance(p, q)

    assert 0.0 <= distance <= 1.0


def test_input_distributions_are_normalized():
    p = [2.0, 3.0, 5.0]
    q = [4.0, 1.0, 5.0]

    normalized_p = [0.2, 0.3, 0.5]
    normalized_q = [0.4, 0.1, 0.5]

    assert np.isclose(
        jensen_shannon_distance(p, q),
        jensen_shannon_distance(normalized_p, normalized_q),
    )


def test_negative_probabilities_are_rejected():
    import pytest

    with pytest.raises(ValueError, match="cannot be negative"):
        jensen_shannon_distance(
            [0.8, -0.1, 0.3],
            [0.4, 0.3, 0.3],
        )


def test_zero_mass_distribution_is_rejected():
    import pytest

    with pytest.raises(ValueError, match="positive mass"):
        jensen_shannon_distance(
            [0.0, 0.0, 0.0],
            [0.4, 0.3, 0.3],
        )
