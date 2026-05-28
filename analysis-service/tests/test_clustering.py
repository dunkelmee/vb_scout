"""Tests for clustering module."""
import pytest
from analysis.clustering import wald_wolfowitz, error_sequence_from_rallies


def test_insufficient_data_returns_minus_one():
    """n1 < 5 OR n0 < 5 → returns -1."""
    seq = [1, 1, 1, 0, 0]  # n1=3, n0=2
    assert wald_wolfowitz(seq) == -1.0


def test_perfectly_alternating_low_index():
    """Perfectly alternating → clustering_index near 0.0."""
    seq = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]  # many runs
    result = wald_wolfowitz(seq)
    assert 0.0 <= result <= 0.3, f"Expected low clustering, got {result}"


def test_all_errors_then_clean_high_index():
    """All errors then all clean → clustering near 1.0."""
    seq = [1] * 8 + [0] * 8
    result = wald_wolfowitz(seq)
    assert result >= 0.5, f"Expected high clustering, got {result}"


def test_result_in_range():
    """Result always in [0, 1]."""
    import random
    random.seed(42)
    for _ in range(100):
        seq = [random.randint(0, 1) for _ in range(20)]
        result = wald_wolfowitz(seq)
        if result != -1:
            assert 0.0 <= result <= 1.0


def test_error_sequence_from_rallies():
    rallies = [
        {'point_type': 'us_error', 'scorer': 'them'},
        {'point_type': 'us_positive', 'scorer': 'us'},
        {'point_type': 'them_positive', 'scorer': 'them'},
        {'point_type': 'them_error', 'scorer': 'us'},
    ]
    result = error_sequence_from_rallies(rallies)
    assert result == [1, 0, 1, 0]
