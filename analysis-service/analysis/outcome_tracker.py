"""Training priority outcome measurement."""
from typing import List, Dict, Any
import db


def check_and_record_outcomes(
    team_id: str,
    match_id: str,
    current_metrics: Dict[str, float],
) -> List[Dict]:
    """
    Compare current match metrics against active training priorities.
    Record outcomes and update priority statuses.
    """
    priorities = db.get_active_priorities(team_id)
    outcomes = []

    for priority in priorities:
        metric = priority['metric']
        if metric not in current_metrics:
            continue

        measured_value = current_metrics[metric]
        baseline = float(priority['baseline_value'])
        target = float(priority['target_value'])
        direction = priority['direction']  # 'up' or 'down'

        delta = measured_value - baseline

        # Determine verdict
        if direction == 'up':
            if delta >= 0.02:
                verdict = 'improved'
            elif delta <= -0.02:
                verdict = 'regressed'
            else:
                verdict = 'no_change'
        else:  # down
            if delta <= -0.02:
                verdict = 'improved'
            elif delta >= 0.02:
                verdict = 'regressed'
            else:
                verdict = 'no_change'

        # Record outcome
        db.insert_priority_outcome(
            priority_id=priority['id'],
            measured_match_id=match_id,
            measured_value=measured_value,
            delta=delta,
            verdict=verdict,
        )

        outcomes.append({
            'priority_id': priority['id'],
            'metric': metric,
            'measured_value': measured_value,
            'delta': delta,
            'verdict': verdict,
        })

        # Update priority status based on consecutive outcomes
        _update_priority_status(priority, verdict, measured_value, target, direction)

    return outcomes


def _update_priority_status(priority: Dict, latest_verdict: str,
                              measured_value: float, target: float, direction: str):
    """Update priority status based on progress rules."""
    current_status = priority.get('status', 'active')
    if current_status in ('dismissed',):
        return

    # Check if target crossed
    target_reached = (
        (direction == 'up' and measured_value >= target) or
        (direction == 'down' and measured_value <= target)
    )

    if latest_verdict == 'improved':
        if current_status == 'active':
            db.update_priority_status(priority['id'], 'improving')
        elif current_status == 'improving' and target_reached:
            db.update_priority_status(priority['id'], 'resolved')
    elif latest_verdict == 'regressed':
        if current_status in ('improving', 'resolved'):
            db.update_priority_status(priority['id'], 'regressed')
