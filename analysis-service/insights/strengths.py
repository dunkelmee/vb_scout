"""Strength detection from match metrics."""
from typing import List, Dict, Optional
from .thresholds import STRENGTH_THRESHOLDS, ROTATION_STRENGTH_THRESHOLD


def detect_strengths(metrics: Dict, rotation_profiles: Optional[Dict] = None) -> List[Dict]:
    """Return list of strength insight dicts, sorted by impact proxy."""
    strengths = []
    priority = 1

    for (metric, threshold, direction, label, detail_tmpl) in STRENGTH_THRESHOLDS:
        value = metrics.get(metric)
        if value is None:
            continue

        is_strength = (
            (direction == 'above' and value >= threshold) or
            (direction == 'below' and value <= threshold)
        )

        if is_strength:
            detail = detail_tmpl.format(val=value)
            strengths.append({
                'id': f'strength_{metric}',
                'category': 'strength',
                'priority': priority,
                'title': label,
                'detail': detail,
                'metric': metric,
                'current_value': round(float(value), 4),
                'target_value': threshold,
                'direction': 'maintain',
                'source': 'match_stats',
                'data': {'threshold': threshold, 'value': value},
            })
            priority += 1

    # Rotation strengths
    if rotation_profiles:
        for rot in range(1, 7):
            rot_data = rotation_profiles.get('rotations', {}).get(rot)
            if not rot_data:
                continue
            re = rot_data.get('re', 0)
            if re >= ROTATION_STRENGTH_THRESHOLD and not rot_data.get('low_sample'):
                strengths.append({
                    'id': f'strength_rotation_{rot}',
                    'category': 'strength',
                    'priority': priority,
                    'title': f'Rotation {rot} is a structural strength',
                    'detail': f'Rotation {rot} Efficiency: {re:.2f} (Strong). Win rate: {rot_data["win_rate"]:.0%}.',
                    'metric': f'rotation_{rot}_re',
                    'current_value': round(re, 4),
                    'target_value': ROTATION_STRENGTH_THRESHOLD,
                    'direction': 'maintain',
                    'source': 'rotation_profiles',
                    'data': rot_data,
                })
                priority += 1

    return strengths
