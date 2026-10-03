import numpy as np


def jensen_shannon_distance(p, q):
    """Jensen-Shannon distance using base-2 logarithms."""

    p = np.asarray(p, dtype=float)
    q = np.asarray(q, dtype=float)

    if p.shape != q.shape:
        raise ValueError("Distributions must have identical shape.")

    if np.any(p < 0) or np.any(q < 0):
        raise ValueError("Probabilities cannot be negative.")

    if p.sum() <= 0 or q.sum() <= 0:
        raise ValueError("Distributions must contain positive mass.")

    p = p / p.sum()
    q = q / q.sum()

    m = 0.5 * (p + q)

    def kl_divergence(a, b):
        mask = a > 0
        return np.sum(
            a[mask] * np.log2(a[mask] / b[mask])
        )

    js_divergence = 0.5 * (
        kl_divergence(p, m)
        + kl_divergence(q, m)
    )

    return float(np.sqrt(js_divergence))


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
