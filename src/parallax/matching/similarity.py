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
