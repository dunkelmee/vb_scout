"""Substitution effectiveness analysis."""
from typing import List, Dict


WINDOW = 8
MIN_WINDOW = 4


def compute_substitution_impact(rallies: List[Dict], substitutions: List[Dict]) -> Dict:
    """
    Analyse win rate in 8-rally window before and after each substitution.
    """
    if not substitutions:
        return {'substitutions': [], 'aggregate': None}

    results = []
    for sub in substitutions:
        rally_idx = sub.get('rally_index', 0)
        set_id = sub.get('set_id')

        set_rallies = [r for r in rallies if r.get('set_id') == set_id]
        set_rallies.sort(key=lambda r: r['rally_index'])

        before = [r for r in set_rallies if r['rally_index'] < rally_idx][-WINDOW:]
        after = [r for r in set_rallies if r['rally_index'] > rally_idx][:WINDOW]

        if len(before) < MIN_WINDOW or len(after) < MIN_WINDOW:
            results.append({
                'sub_id': sub.get('id'),
                'player_out': sub.get('player_out_name', ''),
                'player_in': sub.get('player_in_name', ''),
                'is_libero_swap': sub.get('is_libero_swap', False),
                'verdict': 'insufficient_data',
            })
            continue

        win_before = sum(1 for r in before if r['scorer'] == 'us') / len(before)
        win_after = sum(1 for r in after if r['scorer'] == 'us') / len(after)
        delta = win_after - win_before

        if delta > 0.08:
            verdict = 'effective'
        elif delta < -0.08:
            verdict = 'ineffective'
        else:
            verdict = 'neutral'

        results.append({
            'sub_id': sub.get('id'),
            'player_out': sub.get('player_out_name', ''),
            'player_in': sub.get('player_in_name', ''),
            'is_libero_swap': sub.get('is_libero_swap', False),
            'win_rate_before': round(win_before, 4),
            'win_rate_after': round(win_after, 4),
            'delta_win_rate': round(delta, 4),
            'verdict': verdict,
            'at_score': f"{sub.get('at_score_us', 0)}-{sub.get('at_score_them', 0)}",
        })

    effective = sum(1 for r in results if r.get('verdict') == 'effective')
    ineffective = sum(1 for r in results if r.get('verdict') == 'ineffective')
    neutral = sum(1 for r in results if r.get('verdict') == 'neutral')
    total_rated = effective + ineffective + neutral

    return {
        'substitutions': results,
        'aggregate': {
            'effective': effective,
            'neutral': neutral,
            'ineffective': ineffective,
            'effectiveness_rate': effective / total_rated if total_rated > 0 else None,
        } if total_rated > 0 else None,
    }
