"""Weakness detection and action item generation."""
from typing import List, Dict, Optional
from .thresholds import (
    WEAKNESS_THRESHOLDS, ROTATION_WEAKNESS_THRESHOLD, TRAINING_DRILL_TEMPLATES
)
from . import templates as tpl


def detect_weaknesses(
    metrics: Dict,
    rotation_profiles: Optional[Dict] = None,
    sensitivity: Optional[Dict] = None,
    locale: str = 'en',
) -> List[Dict]:
    """Return list of weakness insight dicts, ranked by simulation impact."""
    weaknesses = []

    for (metric, threshold, direction, label, w_id, detail_tmpl) in WEAKNESS_THRESHOLDS:
        value = metrics.get(metric)
        if value is None:
            continue

        is_weakness = (
            (direction == 'above' and value >= threshold) or
            (direction == 'below' and value <= threshold)
        )

        if not is_weakness:
            continue

        # Find simulation impact for this metric
        impact_str = None
        if sensitivity:
            for scenario in (sensitivity if isinstance(sensitivity, list) else sensitivity.get('scenarios', [])):
                if scenario.get('metric') == metric:
                    delta = scenario.get('win_rate_delta', 0)
                    if delta != 0:
                        key = 'impact_addressed_pos' if delta > 0 else 'impact_addressed_neg'
                        impact_str = tpl.misc(key, locale).format(pct=delta * 100)
                    break

        fmt_vars = {'val': value, 'delta': abs(value - threshold)}
        detail = tpl.weakness_detail(w_id, detail_tmpl, locale).format(**fmt_vars)

        weaknesses.append({
            'id': f'weakness_{w_id}',
            'category': 'weakness',
            'priority': 0,  # assigned after sort
            'title': tpl.weakness_label(w_id, label, locale),
            'detail': detail,
            'metric': metric,
            'current_value': round(float(value), 4),
            'target_value': threshold,
            'direction': 'up' if direction == 'below' else 'down',
            'impact': impact_str,
            'source': 'match_stats',
            'data': {'threshold': threshold, 'value': value},
            '_impact_delta': _get_impact_delta(metric, sensitivity),
        })

    # Rotation weaknesses
    if rotation_profiles:
        for rot in range(1, 7):
            rot_data = rotation_profiles.get('rotations', {}).get(rot)
            if not rot_data:
                continue
            re = rot_data.get('re', 0)
            if re <= ROTATION_WEAKNESS_THRESHOLD and not rot_data.get('low_sample'):
                weaknesses.append({
                    'id': f'weakness_rotation_{rot}',
                    'category': 'weakness',
                    'priority': 0,
                    'title': tpl.misc('rotation_weak_title', locale).format(rot=rot),
                    'detail': tpl.misc('rotation_weak_detail', locale).format(rot=rot, re=re, win=rot_data["win_rate"]),
                    'metric': f'rotation_{rot}_re',
                    'current_value': round(re, 4),
                    'target_value': ROTATION_WEAKNESS_THRESHOLD,
                    'direction': 'up',
                    'impact': None,
                    'source': 'rotation_profiles',
                    'data': rot_data,
                    '_impact_delta': re - ROTATION_WEAKNESS_THRESHOLD,
                })

    # Sort by absolute impact delta (most impactful first)
    weaknesses.sort(key=lambda w: abs(w.get('_impact_delta', 0)), reverse=True)

    for i, w in enumerate(weaknesses):
        w['priority'] = i + 1
        del w['_impact_delta']

    return weaknesses


def generate_action_items(weaknesses: List[Dict], sensitivity: Optional[Dict] = None,
                          locale: str = 'en') -> List[Dict]:
    """Generate top 3 action items from weaknesses."""
    top3 = weaknesses[:3]
    actions = []

    for i, weakness in enumerate(top3):
        metric = weakness['metric']
        en_drill = TRAINING_DRILL_TEMPLATES.get(metric)
        drill = tpl.drill(metric, en_drill, locale) if en_drill else tpl.misc('default_drill', locale)

        # Find best sensitivity scenario for this metric
        win_rate_improvement = None
        if sensitivity:
            for scenario in (sensitivity if isinstance(sensitivity, list) else sensitivity.get('scenarios', [])):
                if scenario.get('metric') == metric:
                    win_rate_improvement = scenario.get('win_rate_delta')
                    break

        impact_str = None
        if win_rate_improvement and win_rate_improvement > 0:
            impact_str = tpl.misc('impact_achieved', locale).format(pct=win_rate_improvement * 100)

        actions.append({
            'id': f'action_{i+1}_{metric}',
            'category': 'action_item',
            'priority': i + 1,
            'title': tpl.misc('priority', locale).format(i=i + 1, title=weakness["title"]),
            'detail': tpl.misc('recommended_drill', locale).format(detail=weakness["detail"], drill=drill),
            'metric': metric,
            'current_value': weakness['current_value'],
            'target_value': weakness['target_value'],
            'direction': weakness['direction'],
            'impact': impact_str,
            'source': 'weakness_derived',
            'data': weakness.get('data', {}),
        })

    return actions


def _get_impact_delta(metric: str, sensitivity: Optional[Dict]) -> float:
    if not sensitivity:
        return 0.0
    for scenario in (sensitivity if isinstance(sensitivity, list) else sensitivity.get('scenarios', [])):
        if scenario.get('metric') == metric:
            return abs(scenario.get('win_rate_delta', 0.0))
    return 0.0
