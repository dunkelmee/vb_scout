"""Monte Carlo match simulation with Bayesian profiles and sensitivity analysis."""
import numpy as np
from typing import Dict, Optional, List


N_SIMS = 10000
N_SENSITIVITY = 5000


def _simulate_set(serve_profile: List[float], receive_profile: List[float],
                  serving_first: str, is_fifth: bool, rng: np.random.Generator) -> tuple:
    """
    Simulate one set. Returns (score_us, score_them).
    Profiles: [us_positive, them_positive, them_error, us_error]
    """
    score_us = 0
    score_them = 0
    server = serving_first  # 'us' or 'them'
    target = 15 if is_fifth else 25

    while True:
        profile = serve_profile if server == 'us' else receive_profile
        outcome = rng.choice(4, p=profile)

        if outcome == 0:  # us_positive → us scores
            score_us += 1
            server = 'us'
        elif outcome == 1:  # them_positive → them scores
            score_them += 1
            server = 'them'
        elif outcome == 2:  # them_error → us scores
            score_us += 1
            server = 'us'
        else:  # us_error → them scores
            score_them += 1
            server = 'them'

        # Check win condition
        max_score = max(score_us, score_them)
        min_score = min(score_us, score_them)
        if max_score >= target and max_score - min_score >= 2:
            return score_us, score_them


def simulate_match(
    serve_profile: List[float],
    receive_profile: List[float],
    first_serve: str = 'us',
    n_sims: int = N_SIMS,
    seed: Optional[int] = None,
) -> Dict:
    """Run Monte Carlo simulation of best-of-5 match."""
    rng = np.random.default_rng(seed)

    us_wins = 0
    score_distributions = {'3-0': 0, '3-1': 0, '3-2': 0, '0-3': 0, '1-3': 0, '2-3': 0}
    set_win_rates = [0, 0, 0, 0, 0]
    sets_played_total = 0

    for _ in range(n_sims):
        sets_us = 0
        sets_them = 0
        set_num = 0

        while sets_us < 3 and sets_them < 3:
            is_fifth = (sets_us + sets_them == 4)
            # Alternate serve: odd sets start with first_serve, even sets alternate
            if set_num % 2 == 0:
                serving = first_serve
            else:
                serving = 'them' if first_serve == 'us' else 'us'

            su, st = _simulate_set(serve_profile, receive_profile, serving, is_fifth, rng)
            won = su > st
            if won:
                sets_us += 1
            else:
                sets_them += 1

            if won:
                set_win_rates[set_num] += 1
            set_num += 1

        sets_played_total += sets_us + sets_them

        match_result = f"{sets_us}-{sets_them}"
        if match_result in score_distributions:
            score_distributions[match_result] += 1
        if sets_us > sets_them:
            us_wins += 1

    baseline_win_pct = us_wins / n_sims
    avg_sets_played = sets_played_total / n_sims

    set_win_rate_list = [
        set_win_rates[i] / n_sims for i in range(5)
    ]

    dist_pct = {k: v / n_sims for k, v in score_distributions.items()}

    return {
        'baseline_win_pct': round(baseline_win_pct, 4),
        'score_distribution': dist_pct,
        'avg_sets_played': round(avg_sets_played, 2),
        'set_win_rates': set_win_rate_list,
        'n_sims': n_sims,
    }


def run_sensitivity(
    serve_profile: List[float],
    receive_profile: List[float],
    first_serve: str = 'us',
    n_sims: int = N_SENSITIVITY,
) -> Dict:
    """
    12 sensitivity scenarios — 5pp/10pp improvements to key metrics.
    Returns ranked list with win_rate delta per scenario.
    """
    baseline = simulate_match(serve_profile, receive_profile, first_serve, n_sims, seed=42)
    base_win = baseline['baseline_win_pct']

    scenarios = []

    def tweak(profile: List[float], from_idx: int, to_idx: int, delta: float) -> List[float]:
        """Move `delta` probability mass from from_idx to to_idx."""
        p = list(profile)
        actual_delta = min(delta, p[from_idx])
        p[from_idx] -= actual_delta
        p[to_idx] += actual_delta
        total = sum(p)
        return [x / total for x in p]

    # Serve scenarios
    for delta, label_suffix in [(0.05, '5pp'), (0.10, '10pp')]:
        # Reduce own errors on serve
        sp = tweak(serve_profile, 3, 0, delta)
        r = simulate_match(sp, receive_profile, first_serve, n_sims, seed=42)
        scenarios.append({
            'id': f'reduce_serve_errors_{label_suffix}',
            'label': f'Reduce service errors by {int(delta*100)}pp',
            'metric': 'own_err_serve',
            'delta': delta,
            'win_rate': r['baseline_win_pct'],
            'win_rate_delta': round(r['baseline_win_pct'] - base_win, 4),
        })

        # Improve positive play on serve
        sp = tweak(serve_profile, 3, 0, delta / 2)
        sp = tweak(sp, 2, 0, delta / 2)
        r = simulate_match(sp, receive_profile, first_serve, n_sims, seed=42)
        scenarios.append({
            'id': f'improve_serve_positive_{label_suffix}',
            'label': f'Improve positive play on serve by {int(delta*100)}pp',
            'metric': 'own_pos_serve',
            'delta': delta,
            'win_rate': r['baseline_win_pct'],
            'win_rate_delta': round(r['baseline_win_pct'] - base_win, 4),
        })

    # Receive scenarios
    for delta, label_suffix in [(0.05, '5pp'), (0.10, '10pp')]:
        # Reduce own errors on receive
        rp = tweak(receive_profile, 3, 0, delta)
        r = simulate_match(serve_profile, rp, first_serve, n_sims, seed=42)
        scenarios.append({
            'id': f'reduce_receive_errors_{label_suffix}',
            'label': f'Reduce reception errors by {int(delta*100)}pp',
            'metric': 'own_err_receive',
            'delta': delta,
            'win_rate': r['baseline_win_pct'],
            'win_rate_delta': round(r['baseline_win_pct'] - base_win, 4),
        })

        # Improve positive play on receive
        rp = tweak(receive_profile, 3, 0, delta / 2)
        rp = tweak(rp, 1, 0, delta / 2)
        r = simulate_match(serve_profile, rp, first_serve, n_sims, seed=42)
        scenarios.append({
            'id': f'improve_receive_positive_{label_suffix}',
            'label': f'Improve positive play on reception by {int(delta*100)}pp',
            'metric': 'own_pos_receive',
            'delta': delta,
            'win_rate': r['baseline_win_pct'],
            'win_rate_delta': round(r['baseline_win_pct'] - base_win, 4),
        })

    # Combined scenarios
    for delta, label_suffix in [(0.05, '5pp'), (0.10, '10pp')]:
        sp = tweak(serve_profile, 3, 0, delta / 2)
        rp = tweak(receive_profile, 3, 0, delta / 2)
        r = simulate_match(sp, rp, first_serve, n_sims, seed=42)
        scenarios.append({
            'id': f'combined_error_reduction_{label_suffix}',
            'label': f'Reduce all errors by {int(delta*100/2)}pp',
            'metric': 'combined_errors',
            'delta': delta,
            'win_rate': r['baseline_win_pct'],
            'win_rate_delta': round(r['baseline_win_pct'] - base_win, 4),
        })

    # Sort by impact descending
    scenarios.sort(key=lambda s: s['win_rate_delta'], reverse=True)
    top = scenarios[0] if scenarios else None

    return {
        'baseline_win_pct': base_win,
        'scenarios': scenarios,
        'top_intervention': top,
        'ranking': [s['id'] for s in scenarios],
    }
