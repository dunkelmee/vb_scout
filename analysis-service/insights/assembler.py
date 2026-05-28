"""Assemble full insight package from analysis modules."""
from typing import Dict, Optional
from .strengths import detect_strengths
from .weaknesses import detect_weaknesses, generate_action_items


def extract_flat_metrics(analysis_result: Dict) -> Dict:
    """Flatten analysis module outputs into a single metrics dict."""
    metrics = {}

    profiles = analysis_result.get('profiles')
    if profiles:
        us = profiles.get('us', {})
        opp = profiles.get('opponent', {})

        serve = us.get('on_serve', [0, 0, 0, 0])
        receive = us.get('on_receive', [0, 0, 0, 0])
        opp_serve = opp.get('on_serve', [0, 0, 0, 0])

        metrics['own_pos_serve'] = serve[0] if len(serve) > 0 else 0
        metrics['own_err_serve'] = serve[3] if len(serve) > 3 else 0
        metrics['opp_err_serve'] = opp_serve[3] if len(opp_serve) > 3 else 0
        metrics['own_pos_receive'] = receive[0] if len(receive) > 0 else 0
        metrics['own_err_receive'] = receive[3] if len(receive) > 3 else 0

    # Derived from rotation profiles
    rp = analysis_result.get('rotation_profiles')
    if rp:
        # Use overall serve/receive stats from all rallies
        all_break = []
        all_sideout = []
        for rot_data in rp.get('rotations', {}).values():
            if isinstance(rot_data, dict) and not rot_data.get('low_sample'):
                all_break.append(rot_data.get('break_pct', 0))
                all_sideout.append(rot_data.get('sideout_pct', 0))

        if all_break:
            metrics['break_pct'] = sum(all_break) / len(all_break)
        if all_sideout:
            metrics['sideout_pct'] = sum(all_sideout) / len(all_sideout)

        metrics['rbi'] = rp.get('rbi', 0)

    # Set profiles
    sp = analysis_result.get('set_profiles')
    if sp:
        metrics['late_match_drop'] = 1.0 if sp.get('late_match_drop') else 0.0

    # Score context
    sc = analysis_result.get('score_context')
    if sc:
        ps = sc.get('pressure_sensitivity')
        if ps is not None:
            metrics['pressure_sensitivity'] = ps
        cs = sc.get('clutch_score')
        if cs is not None:
            metrics['clutch_score'] = cs

    # Timeout impact
    ti = analysis_result.get('timeout_impact')
    if ti:
        te = ti.get('timeout_effectiveness')
        if te is not None:
            metrics['timeout_effectiveness'] = te

    # Clustering
    tus_retro = analysis_result.get('tus_retrospective')
    if tus_retro:
        peak = tus_retro.get('peak_tus', 0)
        metrics['error_clustering'] = min(1.0, peak)

    return metrics


def assemble_insights(analysis_result: Dict) -> Dict:
    """Build the full insights payload from raw analysis data."""
    metrics = extract_flat_metrics(analysis_result)
    rotation_profiles = analysis_result.get('rotation_profiles')
    sensitivity = analysis_result.get('simulation', {}).get('sensitivity') if analysis_result.get('simulation') else None

    strengths = detect_strengths(metrics, rotation_profiles)
    weaknesses = detect_weaknesses(metrics, rotation_profiles, sensitivity)
    action_items = generate_action_items(weaknesses, sensitivity)

    sim = analysis_result.get('simulation', {})
    simulation_summary = None
    if sim:
        simulation_summary = {
            'baseline_win_pct': sim.get('baseline_win_pct'),
            'score_distribution': sim.get('score_distribution'),
            'avg_sets_played': sim.get('avg_sets_played'),
            'set_win_rates': sim.get('set_win_rates'),
            'top_intervention': sim.get('top_intervention') if isinstance(sim.get('top_intervention'), dict) else None,
        }

    return {
        'strengths': strengths,
        'weaknesses': weaknesses,
        'action_items': action_items,
        'metrics': metrics,
    }, simulation_summary
