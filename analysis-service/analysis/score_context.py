"""Score context and pressure situation profiling."""
from typing import List, Dict, Optional


CONTEXT_SEGMENTS = {
    'comfortable_lead': (5, 100),
    'leading': (2, 4),
    'level': (-1, 1),
    'trailing': (-4, -2),
    'significant_deficit': (-100, -5),
}


def get_score_context(score_us: int, score_them: int) -> str:
    diff = score_us - score_them
    for label, (low, high) in CONTEXT_SEGMENTS.items():
        if low <= diff <= high:
            return label
    return 'level'


def compute_score_context(rallies: List[Dict]) -> Optional[Dict]:
    """
    Segment rallies by score context and compute win rates per segment.
    Minimum 5 rallies per segment to include.
    """
    segments: Dict[str, List[Dict]] = {k: [] for k in CONTEXT_SEGMENTS}

    for r in rallies:
        # Use score BEFORE this rally (previous state)
        score_us = r['score_us'] - (1 if r['scorer'] == 'us' else 0)
        score_them = r['score_them'] - (1 if r['scorer'] == 'them' else 0)
        ctx = get_score_context(score_us, score_them)
        segments[ctx].append(r)

    result = {}
    for ctx, seg_rallies in segments.items():
        if len(seg_rallies) < 5:
            result[ctx] = None
            continue
        wins = sum(1 for r in seg_rallies if r['scorer'] == 'us')
        result[ctx] = {
            'win_rate': wins / len(seg_rallies),
            'n': len(seg_rallies),
        }

    # Pressure sensitivity: level vs comfortable_lead win rate delta
    level = result.get('level')
    comfortable = result.get('comfortable_lead')
    if level and comfortable:
        pressure_sensitivity = level['win_rate'] - comfortable['win_rate']
    else:
        pressure_sensitivity = None

    # Clutch score: win rate when both scores ≥ 20
    clutch_rallies = [
        r for r in rallies
        if r['score_us'] >= 20 and r['score_them'] >= 20
    ]
    clutch_score = None
    if len(clutch_rallies) >= 5:
        clutch_wins = sum(1 for r in clutch_rallies if r['scorer'] == 'us')
        clutch_score = clutch_wins / len(clutch_rallies)

    return {
        'segments': result,
        'pressure_sensitivity': pressure_sensitivity,
        'clutch_score': clutch_score,
        'n_total': len(rallies),
    }
