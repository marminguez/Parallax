"""Transparent similarity scoring for mission-specific fingerprints."""

from collections.abc import Mapping


def weighted_similarity(target: Mapping[str, float], candidate: Mapping[str, float], weights: Mapping[str, float]) -> float:
    """Return a 0..1 weighted similarity score for normalized features."""
    features = set(weights)
    if features != set(target) or features != set(candidate):
        raise ValueError("Target, candidate and weights must contain identical features.")
    total_weight = sum(weights.values())
    if total_weight <= 0:
        raise ValueError("Weights must sum to a positive value.")
    score = 0.0
    for feature in features:
        t, c, w = target[feature], candidate[feature], weights[feature]
        if not (0.0 <= t <= 1.0 and 0.0 <= c <= 1.0):
            raise ValueError(f"{feature} must be normalized to 0..1.")
        if w < 0:
            raise ValueError("Weights cannot be negative.")
        score += w * (1.0 - abs(t - c))
    return score / total_weight


def jensen_shannon_distance(p, q) -> float:
    """Return the base-2 Jensen-Shannon distance between two distributions."""
    import numpy as np

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
