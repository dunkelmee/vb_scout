"""Wald-Wolfowitz runs test for error clustering."""
import math
from typing import List


def wald_wolfowitz(sequence: List[int]) -> float:
    """
    sequence: binary, 1 = error rally, 0 = clean
    Returns clustering_index in [0, 1], or -1 if insufficient (n1<5 or n0<5)
    """
    n1 = sum(1 for x in sequence if x == 1)
    n0 = sum(1 for x in sequence if x == 0)

    if n1 < 5 or n0 < 5:
        return -1.0

    runs = 1
    for i in range(1, len(sequence)):
        if sequence[i] != sequence[i - 1]:
            runs += 1

    n = n1 + n0
    ER = (2 * n1 * n0) / n + 1
    VR = (2 * n1 * n0 * (2 * n1 * n0 - n)) / (n * n * (n - 1))

    if VR <= 0:
        return 0.0

    Z = (runs - ER) / math.sqrt(VR)
    return min(1.0, max(0.0, -Z / 3))


def error_sequence_from_rallies(rallies: List[dict]) -> List[int]:
    """Convert rally list to binary error sequence."""
    return [
        1 if r.get('point_type') in ('us_error', 'them_positive') else 0
        for r in rallies
    ]
