"""Tests for TUS computation."""
import pytest
from analysis.tus_retrospective import compute_tus


def make_rally(scorer, point_type, score_us, score_them):
    return {'scorer': scorer, 'point_type': point_type, 'score_us': score_us, 'score_them': score_them, 'serving_team': 'us', 'rally_index': 0}


def test_tus_in_range():
    """TUS always in [0, 1]."""
    rallies = [make_rally('us', 'us_positive', i, 0) for i in range(1, 7)]
    tus = compute_tus(rallies, 6, 0)
    assert 0.0 <= tus <= 1.0


def test_all_losses_approaches_one():
    """All-losses window → TUS approaches 1.0."""
    rallies = [make_rally('them', 'us_error', 0, i) for i in range(1, 7)]
    tus = compute_tus(rallies, 0, 6)
    assert tus > 0.7, f"Expected high TUS for all losses, got {tus}"


def test_all_wins_approaches_zero():
    """All-wins window → TUS approaches 0.0."""
    rallies = [make_rally('us', 'us_positive', i, 0) for i in range(1, 7)]
    tus = compute_tus(rallies, 6, 0)
    assert tus < 0.4, f"Expected low TUS for all wins, got {tus}"


def test_cold_start_empty():
    """Empty window → valid value (0.5)."""
    tus = compute_tus([], 0, 0)
    assert tus == 0.5


def test_cold_start_small_window():
    """< 6 rallies → valid value."""
    rallies = [make_rally('us', 'us_positive', i, 0) for i in range(1, 4)]
    tus = compute_tus(rallies, 3, 0)
    assert 0.0 <= tus <= 1.0
