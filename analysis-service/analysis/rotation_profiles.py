"""Per-rotation probability profiles and efficiency metrics."""
from typing import List, Dict, Optional


def get_setter_zone(rotation_after: dict, player_positions: Dict[str, List[str]]) -> int:
    """Determine rotation number from setter's zone."""
    for zone, player_id in rotation_after.items():
        positions = player_positions.get(str(player_id), [])
        if 'Setter' in positions:
            zone_num = int(zone.replace('zone', ''))
            return zone_num
    return 1


def compute_rotation_profiles(
    rallies: List[Dict],
    player_positions: Dict[str, List[str]],
) -> Dict:
    """
    Compute per-rotation efficiency metrics.

    Returns dict with rotation 1-6 stats and aggregate TRE/RBI.
    """
    rotations = {i: {
        'rallies': [], 'wins': 0, 'losses': 0,
        'serve_rallies': [], 'receive_rallies': [],
    } for i in range(1, 7)}

    for r in rallies:
        rotation_after = r.get('rotation_after') or {}
        rot = get_setter_zone(rotation_after, player_positions)
        slot = rotations[rot]
        slot['rallies'].append(r)
        if r['scorer'] == 'us':
            slot['wins'] += 1
        else:
            slot['losses'] += 1
        if r['serving_team'] == 'us':
            slot['serve_rallies'].append(r)
        else:
            slot['receive_rallies'].append(r)

    result = {}
    re_values = []

    for rot in range(1, 7):
        slot = rotations[rot]
        total = slot['wins'] + slot['losses']
        if total == 0:
            result[rot] = {
                'rotation': rot, 'rallies': 0, 'win_rate': 0,
                'break_pct': 0, 'sideout_pct': 0,
                'error_rate_serve': 0, 'error_rate_receive': 0,
                'positive_play_serve': 0, 'positive_play_receive': 0,
                're': 0, 'low_sample': True,
            }
            re_values.append(0.0)
            continue

        win_rate = slot['wins'] / total if total > 0 else 0
        serve = slot['serve_rallies']
        receive = slot['receive_rallies']

        break_pct = (
            sum(1 for r in serve if r['scorer'] == 'us') / len(serve)
            if serve else 0
        )
        sideout_pct = (
            sum(1 for r in receive if r['scorer'] == 'us') / len(receive)
            if receive else 0
        )
        error_rate_serve = (
            sum(1 for r in serve if r['point_type'] in ('us_error', 'them_positive')) / len(serve)
            if serve else 0
        )
        error_rate_receive = (
            sum(1 for r in receive if r['point_type'] in ('us_error', 'them_positive')) / len(receive)
            if receive else 0
        )
        positive_play_serve = (
            sum(1 for r in serve if r['point_type'] == 'us_positive' and r['scorer'] == 'us') /
            max(1, sum(1 for r in serve if r['scorer'] == 'us'))
            if serve else 0
        )
        positive_play_receive = (
            sum(1 for r in receive if r['point_type'] == 'us_positive' and r['scorer'] == 'us') /
            max(1, sum(1 for r in receive if r['scorer'] == 'us'))
            if receive else 0
        )

        # Rotation Efficiency (RE)
        normalised_win = win_rate
        quality_sideout = min(1.0, sideout_pct / 0.55)
        quality_break = min(1.0, break_pct / 0.45)
        re = (normalised_win + quality_sideout + quality_break) / 3

        re_values.append(re)
        result[rot] = {
            'rotation': rot,
            'rallies': total,
            'win_rate': round(win_rate, 4),
            'break_pct': round(break_pct, 4),
            'sideout_pct': round(sideout_pct, 4),
            'error_rate_serve': round(error_rate_serve, 4),
            'error_rate_receive': round(error_rate_receive, 4),
            'positive_play_serve': round(positive_play_serve, 4),
            'positive_play_receive': round(positive_play_receive, 4),
            're': round(re, 4),
            'low_sample': total < 6,
            're_label': _re_label(re),
        }

    # Team Rotation Efficiency (TRE)
    total_rallies = sum(rotations[r]['wins'] + rotations[r]['losses'] for r in range(1, 7))
    if total_rallies > 0:
        tre = sum(
            re_values[r - 1] * (rotations[r]['wins'] + rotations[r]['losses']) / total_rallies
            for r in range(1, 7)
        )
    else:
        tre = 0.0

    # Rotation Balance Index (RBI)
    import statistics as stats_mod
    non_zero = [v for v in re_values if v > 0]
    if len(non_zero) >= 2:
        rbi = max(0.0, 1.0 - stats_mod.stdev(re_values) / 0.5)
    else:
        rbi = 1.0

    return {
        'rotations': result,
        'tre': round(tre, 4),
        'rbi': round(rbi, 4),
    }


def _re_label(re: float) -> str:
    if re >= 0.65:
        return 'Strong'
    elif re >= 0.50:
        return 'Solid'
    elif re >= 0.35:
        return 'Weak'
    else:
        return 'Critical'
