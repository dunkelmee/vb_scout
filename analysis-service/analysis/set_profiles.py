"""Per-set performance comparison and trend detection."""
from typing import List, Dict, Optional


def compute_set_profiles(sets_data: List[Dict], rallies: List[Dict]) -> Optional[Dict]:
    """
    Detect performance trends across sets.
    Each set needs ≥8 rallies to be included.
    """
    valid_sets = []
    for s in sets_data:
        set_rallies = [r for r in rallies if r.get('set_id') == s['id'] or
                       r.get('set_number') == s['set_number']]
        if len(set_rallies) >= 8:
            valid_sets.append((s, set_rallies))

    if len(valid_sets) < 2:
        return None

    set_metrics = []
    for s, s_rallies in valid_sets:
        total = len(s_rallies)
        wins = sum(1 for r in s_rallies if r['scorer'] == 'us')
        win_rate = wins / total if total > 0 else 0

        serve = [r for r in s_rallies if r['serving_team'] == 'us']
        receive = [r for r in s_rallies if r['serving_team'] == 'them']

        sideout = sum(1 for r in receive if r['scorer'] == 'us') / max(1, len(receive))
        break_pct = sum(1 for r in serve if r['scorer'] == 'us') / max(1, len(serve))
        error_rate = sum(1 for r in s_rallies if r['point_type'] in ('us_error', 'them_positive')) / total

        set_metrics.append({
            'set_number': s['set_number'],
            'win_rate': win_rate,
            'sideout_pct': sideout,
            'break_pct': break_pct,
            'error_rate': error_rate,
            'rallies': total,
        })

    # Trend via linear regression
    x = [m['set_number'] for m in set_metrics]
    y_win = [m['win_rate'] for m in set_metrics]
    trend = _linear_slope(x, y_win)

    if trend > 0.03:
        trend_label = 'improving'
    elif trend < -0.03:
        trend_label = 'deteriorating'
    else:
        trend_label = 'stable'

    # Late match drop: sets 4/5 win rate vs sets 1-3 average
    late_match_drop = False
    early_sets = [m['win_rate'] for m in set_metrics if m['set_number'] <= 3]
    late_sets = [m['win_rate'] for m in set_metrics if m['set_number'] >= 4]
    if early_sets and late_sets:
        avg_early = sum(early_sets) / len(early_sets)
        avg_late = sum(late_sets) / len(late_sets)
        if avg_early - avg_late > 0.08:
            late_match_drop = True

    return {
        'set_metrics': set_metrics,
        'win_rate_trend': round(trend, 4),
        'trend_label': trend_label,
        'late_match_drop': late_match_drop,
        'n_sets_analysed': len(set_metrics),
    }


def _linear_slope(x: List[float], y: List[float]) -> float:
    """Compute slope of least squares regression line."""
    n = len(x)
    if n < 2:
        return 0.0
    x_mean = sum(x) / n
    y_mean = sum(y) / n
    numerator = sum((x[i] - x_mean) * (y[i] - y_mean) for i in range(n))
    denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
    if denominator == 0:
        return 0.0
    return numerator / denominator
