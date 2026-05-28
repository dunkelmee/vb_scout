"""Timeout effectiveness analysis."""
from typing import List, Dict
from .clustering import wald_wolfowitz, error_sequence_from_rallies

WINDOW = 5
MIN_WINDOW = 3
TUS_THRESHOLD = 0.75
MISSED_WINDOW = 3


def compute_timeout_impact(rallies: List[Dict], timeouts: List[Dict]) -> Dict:
    """Analyse win rate window before/after timeouts and missed opportunities."""
    results = []

    for to in timeouts:
        rally_idx = to.get('rally_index', 0)
        set_id = to.get('set_id')
        called_by = to.get('called_by', 'us')

        set_rallies = [r for r in rallies if r.get('set_id') == set_id]
        set_rallies.sort(key=lambda r: r['rally_index'])

        before = [r for r in set_rallies if r['rally_index'] < rally_idx][-WINDOW:]
        after = [r for r in set_rallies if r['rally_index'] > rally_idx][:WINDOW]

        # Run before: opponent scoring run
        run_before = 0
        for r in reversed(before):
            if r['scorer'] != 'us':
                run_before += 1
            else:
                break

        if len(before) < MIN_WINDOW or len(after) < MIN_WINDOW:
            results.append({
                'timeout_id': to.get('id'),
                'called_by': called_by,
                'verdict': 'insufficient_data',
            })
            continue

        win_before = sum(1 for r in before if r['scorer'] == 'us') / len(before)
        win_after = sum(1 for r in after if r['scorer'] == 'us') / len(after)
        delta = win_after - win_before

        if delta > 0.10:
            verdict = 'effective'
        elif delta < -0.10:
            verdict = 'ineffective'
        else:
            verdict = 'neutral'

        results.append({
            'timeout_id': to.get('id'),
            'called_by': called_by,
            'run_before': run_before,
            'win_rate_before': round(win_before, 4),
            'win_rate_after': round(win_after, 4),
            'delta_win_rate': round(delta, 4),
            'verdict': verdict,
            'at_score': f"{to.get('at_score_us', 0)}-{to.get('at_score_them', 0)}",
        })

    # Aggregate per side
    our_timeouts = [r for r in results if r.get('called_by') == 'us']
    their_timeouts = [r for r in results if r.get('called_by') == 'them']

    def agg(subset):
        rated = [r for r in subset if r.get('verdict') not in ('insufficient_data', None)]
        if not rated:
            return None
        eff = sum(1 for r in rated if r['verdict'] == 'effective')
        return {
            'effective': eff,
            'neutral': sum(1 for r in rated if r['verdict'] == 'neutral'),
            'ineffective': sum(1 for r in rated if r['verdict'] == 'ineffective'),
            'effectiveness_rate': eff / len(rated),
        }

    # Timeout effectiveness rate for insight
    our_agg = agg(our_timeouts)
    timeout_effectiveness = our_agg['effectiveness_rate'] if our_agg else None

    return {
        'timeouts': results,
        'our_aggregate': our_agg,
        'their_aggregate': agg(their_timeouts),
        'timeout_effectiveness': timeout_effectiveness,
    }
