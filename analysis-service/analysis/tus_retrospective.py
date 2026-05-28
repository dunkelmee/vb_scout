"""TUS retrospective replay and annotation."""
from typing import List, Dict, Tuple
import math


DEFAULT_WEIGHTS = {
    'momentum': 0.30,
    'error': 0.25,
    'lead_deficit': 0.25,
    'positive': 0.20,
}
DEFAULT_WINDOW = 6


def _wald_wolfowitz_index(sequence: List[int]) -> float:
    n1 = sum(sequence)
    n0 = len(sequence) - n1
    if n1 < 5 or n0 < 5:
        return 0.0

    runs = 1
    for i in range(1, len(sequence)):
        if sequence[i] != sequence[i - 1]:
            runs += 1

    n = n1 + n0
    ER = 2 * n1 * n0 / n + 1
    VR = 2 * n1 * n0 * (2 * n1 * n0 - n) / (n * n * (n - 1))
    if VR <= 0:
        return 0.0
    Z = (runs - ER) / math.sqrt(VR)
    return min(1.0, max(0.0, -Z / 3))


def compute_tus(
    rallies_window: List[Dict],
    score_us: int,
    score_them: int,
    weights: Dict = None,
) -> float:
    w = weights or DEFAULT_WEIGHTS

    window = rallies_window
    n = len(window)
    if n == 0:
        return 0.5

    # Signal 1: Momentum
    our_pts = sum(1 for r in window if r['scorer'] == 'us')
    their_pts = n - our_pts
    momentum_raw = (our_pts - their_pts) / n
    momentum_signal = 1 - ((momentum_raw + 1) / 2)

    # Signal 2: Error ratio
    errors = [1 if r.get('point_type') in ('us_error', 'them_positive') else 0 for r in window]
    rolling_errors = sum(errors)
    clustering_index = _wald_wolfowitz_index(errors)
    error_signal = 0.5 * (rolling_errors / n) + 0.5 * clustering_index

    # Signal 3: Lead/deficit
    deficit = max(0, score_them - score_us) / 10
    deficit_trend = (score_them - score_us) / 10
    deficit_trend_normalised = max(0.0, min(1.0, (deficit_trend + 1) / 2))
    lead_deficit_signal = 0.5 * deficit + 0.5 * deficit_trend_normalised

    # Signal 4: Positive play trend
    positive_pts = sum(1 for r in window if r.get('point_type') == 'us_positive')
    trend_raw = (positive_pts / n - 0.5) * 2
    positive_signal = max(0.0, min(1.0, trend_raw / 0.5 + 0.5))

    tus = (
        w.get('momentum', 0.30) * momentum_signal +
        w.get('error', 0.25) * error_signal +
        w.get('lead_deficit', 0.25) * lead_deficit_signal +
        w.get('positive', 0.20) * positive_signal
    )

    return max(0.0, min(1.0, tus))


def compute_tus_retrospective(rallies: List[Dict], timeouts: List[Dict], window: int = DEFAULT_WINDOW) -> Dict:
    """Replay TUS for all rallies and annotate with timeout events."""
    tus_timeline = []
    timeout_rally_indices = {t['rally_index'] for t in timeouts if t.get('called_by') == 'us'}

    for i, rally in enumerate(rallies):
        window_start = max(0, i - window + 1)
        w_rallies = rallies[window_start:i + 1]
        tus = compute_tus(w_rallies, rally['score_us'], rally['score_them'])
        tus_timeline.append({
            'rally_index': rally['rally_index'],
            'tus': round(tus, 4),
            'score_us': rally['score_us'],
            'score_them': rally['score_them'],
            'has_timeout': rally['rally_index'] in timeout_rally_indices,
        })

    if not tus_timeline:
        return {
            'tus_timeline': [],
            'peak_tus': 0.0,
            'time_above_75': 0,
            'time_above_55': 0,
            'missed_timeouts': [],
            'timely_timeouts': 0,
            'late_timeouts': 0,
        }

    tus_values = [t['tus'] for t in tus_timeline]
    peak_tus = max(tus_values)
    time_above_75 = sum(1 for t in tus_values if t >= 0.75)
    time_above_55 = sum(1 for t in tus_values if t >= 0.55)

    # Missed timeout moments: TUS > 0.75, no timeout in next 3 rallies
    missed = []
    timeout_idxs = sorted(timeout_rally_indices)
    for entry in tus_timeline:
        if entry['tus'] >= 0.75 and not entry['has_timeout']:
            # Check if timeout called within next 3 rallies
            ri = entry['rally_index']
            near_timeout = any(abs(ti - ri) <= 3 for ti in timeout_idxs)
            if not near_timeout:
                missed.append({'rally_index': ri, 'tus': entry['tus'],
                                'score': f"{entry['score_us']}-{entry['score_them']}"})

    # Timely vs late timeouts
    timely = 0
    late = 0
    for ti in timeout_idxs:
        # Find TUS just before this timeout
        prior = [e for e in tus_timeline if e['rally_index'] < ti]
        if prior:
            tus_before = prior[-1]['tus']
            if tus_before >= 0.55:
                timely += 1
            else:
                late += 1

    return {
        'tus_timeline': tus_timeline,
        'peak_tus': round(peak_tus, 4),
        'time_above_75': time_above_75,
        'time_above_55': time_above_55,
        'missed_timeouts': missed,
        'timely_timeouts': timely,
        'late_timeouts': late,
    }
